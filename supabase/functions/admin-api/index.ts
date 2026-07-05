import { corsHeaders } from '../_shared/cors.ts';
import { errorResponse, json, JsonRecord, parsePositiveInt, readJson } from '../_shared/http.ts';
import { assertAdminRole, createServiceClient, requireAdmin, writeAuditLog } from '../_shared/adminAuth.ts';

const ALLOWED_ORDER_STATUSES = new Set(['new', 'preparing', 'done']);
const ALLOWED_MENU_FIELDS = new Set(['name', 'description', 'category', 'price', 'restaurant_id', 'active', 'image']);
const STAFF_ACTIONS = new Set(['staffLogin','getStaffOrders','getStaffCalls','staffUpdateStatus','staffArchiveOrder','staffAcknowledgeWaiterCall','staffArchiveWaiterCall','staffArchiveDoneOrders','staffArchiveWaiterCalls']);

type TableZone = { id?: number; restaurant_id?: number; label?: string; table_from?: number; table_to?: number; active?: boolean };
type StaffDevice = { id: string; restaurant_id: number; device_id: string; label?: string; status: 'pending' | 'approved' | 'revoked'; expires_at?: string | null; session_token_hash?: string | null; session_expires_at?: string | null; device_type?: string | null; browser_name?: string | null; os_name?: string | null; user_agent?: string | null };

function normalizeMenuPayload(raw: unknown, restaurantId: number) {
  const source = (raw || {}) as JsonRecord;
  const payload: JsonRecord = {};
  for (const [key, value] of Object.entries(source)) {
    if (!ALLOWED_MENU_FIELDS.has(key)) continue;
    if (key === 'name') payload.name = String(value || '').trim();
    if (key === 'description') payload.description = String(value || '').trim();
    if (key === 'category') payload.category = String(value || '').trim();
    if (key === 'price') payload.price = Number(value || 0);
    if (key === 'restaurant_id') payload.restaurant_id = restaurantId;
    if (key === 'active') payload.active = Boolean(value);
    if (key === 'image') payload.image = value ? String(value) : null;
  }
  if ('name' in payload && !payload.name) throw new Error('Menu item name is required');
  if ('category' in payload && !payload.category) throw new Error('Menu item category is required');
  if ('price' in payload && (!Number.isFinite(Number(payload.price)) || Number(payload.price) < 0)) throw new Error('Invalid price');
  payload.restaurant_id = restaurantId;
  return payload;
}

function toHex(buffer: ArrayBuffer) { return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
async function sha256(value: string) { return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))); }
async function hashPin(pin: string, restaurantId: number) { return sha256(`staff-pin:v1:${restaurantId}:${pin}`); }
async function hashSessionToken(token: string, restaurantId: number, deviceId: string) { return sha256(`staff-session:v1:${restaurantId}:${deviceId}:${token}`); }
function normalizeDeviceId(value: unknown) { const deviceId = String(value || '').trim(); if (!/^[a-zA-Z0-9._:-]{20,160}$/.test(deviceId)) throw new Error('Invalid device id'); return deviceId; }
function normalizeDeviceLabel(value: unknown) { return String(value || 'Pajisje stafi').trim().slice(0, 80) || 'Pajisje stafi'; }
function normalizeDeviceMeta(value: unknown) {
  const meta = (value || {}) as JsonRecord;
  const type = String(meta.type || 'unknown').trim().toLowerCase().slice(0, 30);
  const browser = String(meta.browser || 'Browser').trim().slice(0, 60);
  const os = String(meta.os || 'Unknown OS').trim().slice(0, 60);
  const userAgent = String(meta.userAgent || '').trim().slice(0, 500);
  return { device_type: type, browser_name: browser, os_name: os, user_agent: userAgent };
}
function isExpired(value?: string | null) { return Boolean(value && new Date(value).getTime() < Date.now()); }
async function cleanupStaffDevices(supabase: any, restaurantId: number) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await supabase
    .from('staff_devices')
    .delete()
    .eq('restaurant_id', restaurantId)
    .in('status', ['pending', 'revoked'])
    .lt('updated_at', cutoff)
    .then(() => null);
}

async function softDelete(supabase: any, table: string, id: number, restaurantId: number) {
  const { error } = await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('restaurant_id', restaurantId);
  if (error) throw error;
}

async function acknowledgeWaiterCall(supabase: any, id: number, restaurantId: number) {
  const { data, error } = await supabase
    .from('waiter_calls')
    .update({ status: 'acknowledged', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .eq('status', 'new')
    .is('deleted_at', null)
    .select('id, status')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data;
}

async function closeWaiterCalls(supabase: any, restaurantId: number, ids: number[]) {
  const now = new Date().toISOString();
  const query = supabase
    .from('waiter_calls')
    .update({ status: 'closed', deleted_at: now, updated_at: now })
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null);
  const finalQuery = ids.length ? query.in('id', ids) : query;
  const { data, error } = await finalQuery.select('id');
  if (error) throw error;
  return (data || []).length;
}

async function archiveDoneOrders(supabase: any, restaurantId: number, ids: number[]) {
  const now = new Date().toISOString();
  const query = supabase
    .from('orders')
    .update({ deleted_at: now, updated_at: now })
    .eq('restaurant_id', restaurantId)
    .eq('status', 'done')
    .is('deleted_at', null);
  const finalQuery = ids.length ? query.in('id', ids) : query;
  const { data, error } = await finalQuery.select('id');
  if (error) throw error;
  return (data || []).length;
}

async function getZones(supabase: any, restaurantId: number) {
  const { data, error } = await supabase.from('table_zones').select('id, label, table_from, table_to, active').eq('restaurant_id', restaurantId).eq('active', true).order('table_from', { ascending: true });
  if (error) throw error;
  return (data || []) as TableZone[];
}

function resolveZone(tableNumber: unknown, zones: TableZone[]) {
  const table = parsePositiveInt(tableNumber, 0);
  if (!table) return null;
  const zone = zones.find((entry) => table >= Number(entry.table_from || 0) && table <= Number(entry.table_to || 0));
  return zone ? { id: zone.id, label: zone.label || 'Pa zonë', table_from: zone.table_from, table_to: zone.table_to } : null;
}
function attachZones<T extends { table_number?: unknown }>(rows: T[], zones: TableZone[]) { return rows.map((row) => ({ ...row, zone: resolveZone(row.table_number, zones) })); }

async function getStaffSettings(supabase: any, restaurantId: number) {
  const withMinutes = await supabase
    .from('staff_settings')
    .select('restaurant_id, pin_hash, session_hours, session_minutes, device_expiry_days, updated_at')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (!withMinutes.error) return withMinutes.data || null;

  // Backward-compatible fallback so the admin panel does not crash before db push is applied.
  if (String(withMinutes.error?.message || '').includes('session_minutes')) {
    const withoutMinutes = await supabase
      .from('staff_settings')
      .select('restaurant_id, pin_hash, session_hours, device_expiry_days, updated_at')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (withoutMinutes.error) throw withoutMinutes.error;
    return withoutMinutes.data ? { ...withoutMinutes.data, session_minutes: 0 } : null;
  }

  throw withMinutes.error;
}
async function writeStaffAudit(supabase: any, restaurantId: number, action: string, entityType: string, entityId: number | null, metadata: JsonRecord = {}) {
  try { await supabase.from('audit_logs').insert({ restaurant_id: restaurantId, admin_user_id: null, action, entity_type: entityType, entity_id: entityId, metadata }); } catch { /* ignore */ }
}
async function handleStaffLogin(supabase: any, body: JsonRecord) {
  const restaurantId = parsePositiveInt(body.restaurantId, 1);
  const deviceId = normalizeDeviceId(body.deviceId);
  const label = normalizeDeviceLabel(body.deviceLabel);
  const deviceMeta = normalizeDeviceMeta(body.deviceMeta);
  const pin = String(body.pin || '').trim();
  if (pin.length < 4 || pin.length > 12) return errorResponse('PIN i pavlefshëm.', 400);

  const settings = await getStaffSettings(supabase, restaurantId);
  if (!settings?.pin_hash) return errorResponse('Staff PIN nuk është konfiguruar ende nga menaxheri.', 403);
  if (await hashPin(pin, restaurantId) !== settings.pin_hash) return errorResponse('PIN i gabuar.', 401);

  await cleanupStaffDevices(supabase, restaurantId);

  const { data: existing, error: existingError } = await supabase.from('staff_devices').select('*').eq('restaurant_id', restaurantId).eq('device_id', deviceId).maybeSingle();
  if (existingError) throw existingError;
  const device = existing as StaffDevice | null;

  if (!device) {
    const { data, error } = await supabase
      .from('staff_devices')
      .upsert({
        restaurant_id: restaurantId,
        device_id: deviceId,
        label,
        status: 'pending',
        ...deviceMeta,
        session_token_hash: null,
        session_expires_at: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'restaurant_id,device_id' })
      .select('id, status, created_at')
      .single();
    if (error) throw error;
    await writeStaffAudit(supabase, restaurantId, 'staff.device.request', 'staff_devices', null, { deviceId, label, ...deviceMeta });
    return json({ error: 'DEVICE_PENDING', data, message: 'Kjo pajisje pret aprovimin e menaxherit.' }, 403);
  }

  if (device.status !== 'approved' || isExpired(device.expires_at)) {
    await supabase.from('staff_devices').update({
      status: 'pending',
      label,
      ...deviceMeta,
      session_token_hash: null,
      session_expires_at: null,
      updated_at: new Date().toISOString(),
    }).eq('restaurant_id', restaurantId).eq('device_id', deviceId);
    return json({ error: 'DEVICE_PENDING', data: { id: device.id, status: 'pending' }, message: 'Kjo pajisje pret aprovimin e menaxherit.' }, 403);
  }

  const sessionToken = crypto.randomUUID() + crypto.randomUUID();
  const sessionTokenHash = await hashSessionToken(sessionToken, restaurantId, deviceId);
  const sessionHours = Number(settings.session_hours || 0);
  const sessionMinutes = Number(settings.session_minutes || 0);
  const sessionDurationMinutes = Math.min(Math.max((sessionHours * 60) + sessionMinutes, 1), 72 * 60);
  const sessionExpiresAt = new Date(Date.now() + sessionDurationMinutes * 60 * 1000).toISOString();
  const { error: updateError } = await supabase.from('staff_devices').update({ label, ...deviceMeta, last_seen_at: new Date().toISOString(), session_token_hash: sessionTokenHash, session_expires_at: sessionExpiresAt, updated_at: new Date().toISOString() }).eq('id', device.id);
  if (updateError) throw updateError;
  return json({ data: { sessionToken, sessionExpiresAt, device: { id: device.id, label, status: 'approved' } } });
}

async function requireStaffSession(supabase: any, req: Request, restaurantId: number) {
  const deviceId = normalizeDeviceId(req.headers.get('x-staff-device-id'));
  const sessionToken = String(req.headers.get('x-staff-session') || '').trim();
  if (!sessionToken) throw new Error('Unauthorized');
  const sessionTokenHash = await hashSessionToken(sessionToken, restaurantId, deviceId);
  const { data: device, error } = await supabase.from('staff_devices').select('*').eq('restaurant_id', restaurantId).eq('device_id', deviceId).eq('session_token_hash', sessionTokenHash).maybeSingle();
  if (error) throw error;
  if (!device || device.status !== 'approved') throw new Error('Unauthorized');
  if (isExpired(device.expires_at) || isExpired(device.session_expires_at)) throw new Error('Session expired');
  await supabase.from('staff_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', device.id).then(() => null);
  return device as StaffDevice;
}

async function handleStaffAction(req: Request, body: JsonRecord) {
  const supabase = createServiceClient();
  const action = String(body.action || '').trim();
  if (action === 'staffLogin') return handleStaffLogin(supabase, body);

  const restaurantId = parsePositiveInt(body.restaurantId, 1);
  const device = await requireStaffSession(supabase, req, restaurantId);

  switch (action) {
    case 'getStaffOrders': {
      const [zones, ordersRes] = await Promise.all([
        getZones(supabase, restaurantId),
        supabase.from('orders').select('*').eq('restaurant_id', restaurantId).is('deleted_at', null).order('created_at', { ascending: false }),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      return json({ data: attachZones(ordersRes.data || [], zones) });
    }
    case 'getStaffCalls': {
      const [zones, callsRes] = await Promise.all([
        getZones(supabase, restaurantId),
        supabase.from('waiter_calls').select('*').eq('restaurant_id', restaurantId).is('deleted_at', null).order('created_at', { ascending: false }),
      ]);
      if (callsRes.error) throw callsRes.error;
      return json({ data: attachZones(callsRes.data || [], zones) });
    }
    case 'staffUpdateStatus': {
      const orderId = parsePositiveInt(body.orderId);
      const status = String(body.status || '').trim();
      if (!orderId) return errorResponse('Invalid order id', 400);
      if (!ALLOWED_ORDER_STATUSES.has(status)) return errorResponse('Invalid status', 400);
      const { data, error } = await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', orderId).eq('restaurant_id', restaurantId).is('deleted_at', null).select('id, status').maybeSingle();
      if (error) throw error;
      if (!data) return errorResponse('Order not found', 404);
      await writeStaffAudit(supabase, restaurantId, 'staff.order.status.update', 'orders', orderId, { status, deviceId: device.device_id });
      return json({ data });
    }
    case 'staffArchiveOrder': {
      const orderId = parsePositiveInt(body.id);
      if (!orderId) return errorResponse('Invalid order id', 400);
      const { data: order, error: readError } = await supabase.from('orders').select('id, status').eq('id', orderId).eq('restaurant_id', restaurantId).is('deleted_at', null).maybeSingle();
      if (readError) throw readError;
      if (!order) return errorResponse('Order not found', 404);
      if (order.status !== 'done') return errorResponse('Staff can close only completed orders.', 403);
      const { error } = await supabase.from('orders').update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', orderId).eq('restaurant_id', restaurantId);
      if (error) throw error;
      await writeStaffAudit(supabase, restaurantId, 'staff.order.close', 'orders', orderId, { deviceId: device.device_id });
      return json({ data: true });
    }
    case 'staffAcknowledgeWaiterCall': {
      const id = parsePositiveInt(body.id);
      if (!id) return errorResponse('Invalid waiter call id', 400);
      const data = await acknowledgeWaiterCall(supabase, id, restaurantId);
      if (!data) return errorResponse('Waiter call not found or already accepted.', 404);
      await writeStaffAudit(supabase, restaurantId, 'staff.waiter_call.acknowledge', 'waiter_calls', id, { deviceId: device.device_id });
      return json({ data });
    }
    case 'staffArchiveWaiterCall': {
      const id = parsePositiveInt(body.id);
      if (!id) return errorResponse('Invalid waiter call id', 400);
      const count = await closeWaiterCalls(supabase, restaurantId, [id]);
      if (!count) return errorResponse('Waiter call not found', 404);
      await writeStaffAudit(supabase, restaurantId, 'staff.waiter_call.close', 'waiter_calls', id, { deviceId: device.device_id });
      return json({ data: true });
    }
    case 'staffArchiveDoneOrders': {
      const ids = Array.isArray(body.ids) ? body.ids.map((id) => parsePositiveInt(id, 0)).filter(Boolean) : [];
      if (!ids.length) return json({ data: { count: 0 } });
      const count = await archiveDoneOrders(supabase, restaurantId, ids);
      await writeStaffAudit(supabase, restaurantId, 'staff.orders.bulk_close_done', 'orders', null, { deviceId: device.device_id, count, ids });
      return json({ data: { count } });
    }
    case 'staffArchiveWaiterCalls': {
      const ids = Array.isArray(body.ids) ? body.ids.map((id) => parsePositiveInt(id, 0)).filter(Boolean) : [];
      if (!ids.length) return json({ data: { count: 0 } });
      const count = await closeWaiterCalls(supabase, restaurantId, ids);
      await writeStaffAudit(supabase, restaurantId, 'staff.waiter_calls.bulk_close', 'waiter_calls', null, { deviceId: device.device_id, count, ids });
      return json({ data: { count } });
    }
    default:
      return errorResponse('Unknown staff action', 400);
  }
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    const body = await readJson(req);
    const action = String(body.action || '').trim();
    if (STAFF_ACTIONS.has(action)) return await handleStaffAction(req, body);

    const { supabase, admin } = await requireAdmin(req);
    const restaurantId = admin.restaurantId;

    switch (action) {
      case 'getCurrentAdmin':
        return json({ data: { restaurantId, role: admin.role, userId: admin.userId } });

      case 'getZones': {
        const zones = await getZones(supabase, restaurantId);
        return json({ data: zones, meta: { restaurantId, role: admin.role } });
      }

      case 'getMenu': {
        const { data, error } = await supabase.from('menu').select('*').eq('restaurant_id', restaurantId).is('deleted_at', null).order('category', { ascending: true }).order('name', { ascending: true });
        if (error) throw error;
        return json({ data: data || [], meta: { restaurantId, role: admin.role } });
      }

      case 'saveMenuItem': {
        assertAdminRole(admin, ['owner', 'manager']);
        const editId = body.editId ? parsePositiveInt(body.editId) : 0;
        const payload = normalizeMenuPayload(body.payload, restaurantId);
        const query = editId
          ? supabase.from('menu').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editId).eq('restaurant_id', restaurantId).is('deleted_at', null).select()
          : supabase.from('menu').insert([{ active: true, ...payload }]).select();
        const { data, error } = await query;
        if (error) throw error;
        await writeAuditLog(supabase, admin, editId ? 'menu.update' : 'menu.create', 'menu', editId || Number(data?.[0]?.id || 0), { payload });
        return json({ data: data || [] });
      }

      case 'deleteMenuItem': {
        assertAdminRole(admin, ['owner', 'manager']);
        const id = parsePositiveInt(body.id);
        if (!id) return errorResponse('Invalid menu item id', 400);
        await softDelete(supabase, 'menu', id, restaurantId);
        await writeAuditLog(supabase, admin, 'menu.delete', 'menu', id);
        return json({ data: true });
      }

      case 'getOrders': {
        const [zones, ordersRes] = await Promise.all([
          getZones(supabase, restaurantId),
          supabase.from('orders').select('*').eq('restaurant_id', restaurantId).is('deleted_at', null).order('created_at', { ascending: false }),
        ]);
        if (ordersRes.error) throw ordersRes.error;
        return json({ data: attachZones(ordersRes.data || [], zones) });
      }

      case 'updateStatus': {
        const orderId = parsePositiveInt(body.orderId);
        const status = String(body.status || '').trim();
        if (!orderId) return errorResponse('Invalid order id', 400);
        if (!ALLOWED_ORDER_STATUSES.has(status)) return errorResponse('Invalid status', 400);
        const { data, error } = await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', orderId).eq('restaurant_id', restaurantId).is('deleted_at', null).select('id, status').maybeSingle();
        if (error) throw error;
        if (!data) return errorResponse('Order not found', 404);
        await writeAuditLog(supabase, admin, 'order.status.update', 'orders', orderId, { status });
        return json({ data });
      }

      case 'deleteOrder': {
        assertAdminRole(admin, ['owner', 'manager']);
        const id = parsePositiveInt(body.id);
        if (!id) return errorResponse('Invalid order id', 400);
        const { data: order, error: readError } = await supabase
          .from('orders')
          .select('id, status')
          .eq('id', id)
          .eq('restaurant_id', restaurantId)
          .is('deleted_at', null)
          .maybeSingle();
        if (readError) throw readError;
        if (!order) return errorResponse('Order not found', 404);
        if (order.status !== 'done') return errorResponse('Order must be completed before archiving.', 403);
        await softDelete(supabase, 'orders', id, restaurantId);
        await writeAuditLog(supabase, admin, 'order.delete', 'orders', id);
        return json({ data: true });
      }

      case 'getCalls': {
        const [zones, callsRes] = await Promise.all([
          getZones(supabase, restaurantId),
          supabase.from('waiter_calls').select('*').eq('restaurant_id', restaurantId).is('deleted_at', null).order('created_at', { ascending: false }),
        ]);
        if (callsRes.error) throw callsRes.error;
        return json({ data: attachZones(callsRes.data || [], zones) });
      }

      case 'getArchive': {
        assertAdminRole(admin, ['owner', 'manager', 'supervisor']);
        const [zones, ordersRes, callsRes] = await Promise.all([
          getZones(supabase, restaurantId),
          supabase.from('orders').select('*').eq('restaurant_id', restaurantId).not('deleted_at', 'is', null).order('created_at', { ascending: false }).limit(300),
          supabase.from('waiter_calls').select('*').eq('restaurant_id', restaurantId).not('deleted_at', 'is', null).order('created_at', { ascending: false }).limit(300),
        ]);
        if (ordersRes.error) throw ordersRes.error;
        if (callsRes.error) throw callsRes.error;
        return json({
          data: {
            orders: attachZones(ordersRes.data || [], zones),
            calls: attachZones(callsRes.data || [], zones),
          },
        });
      }

      case 'clearArchive': {
        assertAdminRole(admin, ['owner', 'manager']);
        const [ordersRes, callsRes] = await Promise.all([
          supabase.from('orders').delete().eq('restaurant_id', restaurantId).not('deleted_at', 'is', null).select('id'),
          supabase.from('waiter_calls').delete().eq('restaurant_id', restaurantId).not('deleted_at', 'is', null).select('id'),
        ]);
        if (ordersRes.error) throw ordersRes.error;
        if (callsRes.error) throw callsRes.error;
        const orders = (ordersRes.data || []).length;
        const calls = (callsRes.data || []).length;
        await writeAuditLog(supabase, admin, 'archive.clear', 'archive', null, { orders, calls });
        return json({ data: { orders, calls } });
      }

      case 'acknowledgeWaiterCall': {
        const id = parsePositiveInt(body.id);
        if (!id) return errorResponse('Invalid waiter call id', 400);
        const data = await acknowledgeWaiterCall(supabase, id, restaurantId);
        if (!data) return errorResponse('Waiter call not found or already accepted.', 404);
        await writeAuditLog(supabase, admin, 'waiter_call.acknowledge', 'waiter_calls', id);
        return json({ data });
      }

      case 'deleteWaiterCall': {
        const id = parsePositiveInt(body.id);
        if (!id) return errorResponse('Invalid waiter call id', 400);
        const count = await closeWaiterCalls(supabase, restaurantId, [id]);
        if (!count) return errorResponse('Waiter call not found', 404);
        await writeAuditLog(supabase, admin, 'waiter_call.close', 'waiter_calls', id);
        return json({ data: true });
      }

      case 'archiveDoneOrders': {
        assertAdminRole(admin, ['owner', 'manager', 'supervisor']);
        const ids = Array.isArray(body.ids) ? body.ids.map((id) => parsePositiveInt(id, 0)).filter(Boolean) : [];
        const count = await archiveDoneOrders(supabase, restaurantId, ids);
        await writeAuditLog(supabase, admin, 'orders.bulk_archive_done', 'orders', null, { count, ids });
        return json({ data: { count } });
      }

      case 'archiveWaiterCalls': {
        assertAdminRole(admin, ['owner', 'manager', 'supervisor']);
        const ids = Array.isArray(body.ids) ? body.ids.map((id) => parsePositiveInt(id, 0)).filter(Boolean) : [];
        const count = await closeWaiterCalls(supabase, restaurantId, ids);
        await writeAuditLog(supabase, admin, 'waiter_calls.bulk_close', 'waiter_calls', null, { count, ids });
        return json({ data: { count } });
      }

      case 'getStaffSettings': {
        assertAdminRole(admin, ['owner', 'manager', 'supervisor']);
        const settings = await getStaffSettings(supabase, restaurantId);
        return json({ data: { configured: Boolean(settings?.pin_hash), sessionHours: settings?.session_hours ?? 16, sessionMinutes: settings?.session_minutes ?? 0, deviceExpiryDays: settings?.device_expiry_days || 30 } });
      }

      case 'updateStaffPin': {
        assertAdminRole(admin, ['owner', 'manager', 'supervisor']);
        const existingSettings = await getStaffSettings(supabase, restaurantId);
        const pin = String(body.pin || '').trim();
        const sessionHours = parsePositiveInt(body.sessionHours, 0);
        const sessionMinutes = parsePositiveInt(body.sessionMinutes, 0);
        const deviceExpiryDays = parsePositiveInt(body.deviceExpiryDays, 30);
        const safeSessionHours = Math.min(Math.max(sessionHours, 0), 72);
        const safeSessionMinutes = Math.min(Math.max(sessionMinutes, 0), 59);
        const totalSessionMinutes = (safeSessionHours * 60) + safeSessionMinutes;

        if (pin && !/^\d{4,8}$/.test(pin)) return errorResponse('PIN must be 4-8 digits.', 400);
        if (!pin && !existingSettings?.pin_hash) return errorResponse('PIN must be 4-8 digits.', 400);
        if (totalSessionMinutes < 1) return errorResponse('Session duration must be at least 1 minute.', 400);

        const settingsPayload: JsonRecord = {
          restaurant_id: restaurantId,
          session_hours: safeSessionHours,
          session_minutes: safeSessionMinutes,
          device_expiry_days: Math.min(Math.max(deviceExpiryDays, 1), 365),
          updated_at: new Date().toISOString(),
        };

        if (pin) settingsPayload.pin_hash = await hashPin(pin, restaurantId);
        else settingsPayload.pin_hash = existingSettings.pin_hash;

        let { error } = await supabase
          .from('staff_settings')
          .upsert(settingsPayload, { onConflict: 'restaurant_id' });

        if (error && String(error.message || '').includes('session_minutes')) {
          const fallbackPayload = { ...settingsPayload };
          delete fallbackPayload.session_minutes;
          const fallback = await supabase
            .from('staff_settings')
            .upsert(fallbackPayload, { onConflict: 'restaurant_id' });
          error = fallback.error;
        }

        if (error) throw error;
        await writeAuditLog(supabase, admin, pin ? 'staff.pin.update' : 'staff.session.update', 'staff_settings', restaurantId);
        return json({ data: true });
      }

      case 'getStaffDevices': {
        assertAdminRole(admin, ['owner', 'manager', 'supervisor']);
        await cleanupStaffDevices(supabase, restaurantId);
        const { data, error } = await supabase.from('staff_devices').select('id, device_id, label, status, device_type, browser_name, os_name, approved_at, expires_at, last_seen_at, created_at, updated_at').eq('restaurant_id', restaurantId).order('updated_at', { ascending: false });
        if (error) throw error;
        const now = new Date();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getTime();
        const recentDevices = (data || []).filter((device: any) => {
          const activity = device.last_seen_at || device.approved_at || device.updated_at || device.created_at;
          return activity && new Date(activity).getTime() >= monthStart;
        });
        return json({ data: recentDevices });
      }

      case 'approveStaffDevice': {
        assertAdminRole(admin, ['owner', 'manager', 'supervisor']);
        const id = String(body.id || '').trim();
        if (!id) return errorResponse('Invalid device id', 400);
        const settings = await getStaffSettings(supabase, restaurantId);
        const days = Number(settings?.device_expiry_days || 30);
        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
        const { error } = await supabase.from('staff_devices').update({ status: 'approved', approved_by: admin.userId, approved_at: new Date().toISOString(), expires_at: expiresAt, session_token_hash: null, session_expires_at: null, updated_at: new Date().toISOString() }).eq('id', id).eq('restaurant_id', restaurantId);
        if (error) throw error;
        await writeAuditLog(supabase, admin, 'staff.device.approve', 'staff_devices', null, { id, expiresAt });
        return json({ data: true });
      }

      case 'revokeStaffDevice': {
        assertAdminRole(admin, ['owner', 'manager', 'supervisor']);
        const id = String(body.id || '').trim();
        if (!id) return errorResponse('Invalid device id', 400);
        const { error } = await supabase.from('staff_devices').update({ status: 'revoked', session_token_hash: null, session_expires_at: null, updated_at: new Date().toISOString() }).eq('id', id).eq('restaurant_id', restaurantId);
        if (error) throw error;
        await writeAuditLog(supabase, admin, 'staff.device.revoke', 'staff_devices', null, { id });
        return json({ data: true });
      }

      case 'deleteStaffDevice': {
        assertAdminRole(admin, ['owner', 'manager', 'supervisor']);
        const id = String(body.id || '').trim();
        if (!id) return errorResponse('Invalid device id', 400);
        const { data: device, error: readError } = await supabase
          .from('staff_devices')
          .select('id, device_id, label, status')
          .eq('id', id)
          .eq('restaurant_id', restaurantId)
          .maybeSingle();
        if (readError) throw readError;
        if (!device) return errorResponse('Device not found', 404);
        const { error } = await supabase
          .from('staff_devices')
          .delete()
          .eq('id', id)
          .eq('restaurant_id', restaurantId);
        if (error) throw error;
        await writeAuditLog(supabase, admin, 'staff.device.delete', 'staff_devices', null, { id, deviceId: device.device_id, label: device.label, status: device.status });
        return json({ data: true });
      }

      default:
        return errorResponse('Unknown action', 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Unauthorized' || message === 'Session expired' ? 401 : message === 'Forbidden' || message === 'Insufficient permissions' ? 403 : 500;
    return errorResponse(message, status);
  }
});
