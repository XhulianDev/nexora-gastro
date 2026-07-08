import { corsHeaders } from '../_shared/cors.ts';
import { clampText, errorResponse, json, parsePositiveInt, readJson } from '../_shared/http.ts';
import { createServiceClient } from '../_shared/adminAuth.ts';

type JsonRecord = Record<string, unknown>;
type OrderItemInput = { id?: number | string; qty?: number | string };

const DEFAULT_RESTAURANT_ID = 1;
const WAITER_COOLDOWN_SECONDS = 60;
const WAITER_MAX_CALLS_PER_WINDOW = 2;
const NOTE_MAX_LENGTH = 120;
const MAX_TABLE_NUMBER = 500;
const MAX_ITEM_QTY = 50;
const MAX_ACTIVE_ORDERS_BEFORE_BUSY = 5;
const ALLOWED_RATINGS = new Set(['bad', 'ok', 'good']);
const ALLOWED_WAITER_CALL_TYPES = new Set(['help', 'payment']);

function getCustomerToken(req: Request) {
  const token = (req.headers.get('x-customer-token') || '').trim();
  if (!token) throw new Error('Missing customer token');
  if (token.length < 10 || token.length > 200) throw new Error('Invalid customer token');
  return token;
}

function getRestaurantId(body: JsonRecord) {
  return parsePositiveInt(body.restaurantId ?? body.restaurant_id, DEFAULT_RESTAURANT_ID);
}

function normalizeTableNumber(value: unknown) {
  const tableNumber = parsePositiveInt(value, 0);
  if (!tableNumber || tableNumber > MAX_TABLE_NUMBER) throw new Error('Invalid table number');
  return tableNumber;
}

function normalizeWaiterCallType(value: unknown) {
  const type = String(value || 'help').trim().toLowerCase();
  return ALLOWED_WAITER_CALL_TYPES.has(type) ? type : 'help';
}

function getWaiterCallType(body: JsonRecord) {
  return normalizeWaiterCallType(
    body.callType ?? body.call_type ?? body.waiterCallType ?? body.waiter_call_type ?? body.type ?? body.reason
  );
}

function publicWaiterCall(call: Record<string, unknown>, customerToken: string) {
  const { customer_token: ownerToken, ...safeCall } = call;
  return { ...safeCall, can_cancel: ownerToken === customerToken };
}

function mapPublicWaiterCalls(calls: Record<string, unknown>[] = [], customerToken: string) {
  return calls.map((call) => publicWaiterCall(call, customerToken));
}

function normalizeRequestedItems(rawItems: unknown) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new Error('Order items are required');

  const merged = new Map<number, number>();

  for (const rawItem of rawItems as OrderItemInput[]) {
    const id = parsePositiveInt(rawItem?.id, 0);
    const qty = parsePositiveInt(rawItem?.qty, 0);

    if (!id) throw new Error('Invalid item id');
    if (!qty || qty > MAX_ITEM_QTY) throw new Error('Invalid item quantity');

    merged.set(id, (merged.get(id) || 0) + qty);
  }

  return Array.from(merged.entries()).map(([id, qty]) => ({ id, qty }));
}

async function getMenu(supabase: ReturnType<typeof createServiceClient>, body: JsonRecord) {
  const restaurantId = getRestaurantId(body);

  const { data, error } = await supabase
    .from('menu')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
    .is('deleted_at', null)
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return json({ data: data || [] });
}

async function createOrder(supabase: ReturnType<typeof createServiceClient>, req: Request, body: JsonRecord) {
  const restaurantId = getRestaurantId(body);
  const customerToken = getCustomerToken(req);
  const tableNumber = normalizeTableNumber(body.tableNumber ?? body.table_number);
  const note = clampText(body.note, NOTE_MAX_LENGTH);
  const requestedItems = normalizeRequestedItems(body.items);
  const itemIds = requestedItems.map((item) => item.id);

  const { data: menuItems, error: menuError } = await supabase
    .from('menu')
    .select('id, name, price, active, restaurant_id')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
    .is('deleted_at', null)
    .in('id', itemIds);

  if (menuError) throw menuError;

  const menuMap = new Map((menuItems || []).map((item) => [Number(item.id), item]));

  const snapshotItems = requestedItems.map((requested) => {
    const menuItem = menuMap.get(requested.id);
    if (!menuItem) throw new Error(`Invalid menu item: ${requested.id}`);

    return {
      id: Number(menuItem.id),
      name: String(menuItem.name || ''),
      qty: requested.qty,
      price: Number(menuItem.price || 0),
    };
  });

  const total = Number(snapshotItems.reduce((sum, item) => sum + item.qty * item.price, 0).toFixed(2));
  if (total <= 0) throw new Error('Invalid order total');

  const { data, error } = await supabase
    .from('orders')
    .insert({
      restaurant_id: restaurantId,
      table_number: tableNumber,
      items: snapshotItems,
      total,
      note,
      status: 'new',
      customer_token: customerToken,
    })
    .select('id, restaurant_id, table_number, items, total, note, status, rating, created_at')
    .single();

  if (error) throw error;
  return json({ data });
}

async function getOrders(supabase: ReturnType<typeof createServiceClient>, req: Request, body: JsonRecord) {
  const restaurantId = getRestaurantId(body);
  const customerToken = getCustomerToken(req);
  const ids = Array.isArray(body.ids)
    ? body.ids.map((id) => parsePositiveInt(id, 0)).filter(Boolean)
    : [];

  if (ids.length === 0) return json({ data: [], meta: { isBusy: false } });

  const [busyRes, ordersRes] = await Promise.all([
    supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('customer_token', customerToken)
      .is('deleted_at', null)
      .in('status', ['new', 'preparing']),
    supabase
      .from('orders')
      .select('id, restaurant_id, table_number, items, total, note, status, rating, created_at')
      .eq('restaurant_id', restaurantId)
      .eq('customer_token', customerToken)
      .is('deleted_at', null)
      .in('id', ids)
      .order('created_at', { ascending: true }),
  ]);

  if (busyRes.error) throw busyRes.error;
  if (ordersRes.error) throw ordersRes.error;

  return json({ data: ordersRes.data || [], meta: { isBusy: (busyRes.count || 0) > MAX_ACTIVE_ORDERS_BEFORE_BUSY } });
}


async function getActiveWaiterCalls(supabase: ReturnType<typeof createServiceClient>, req: Request, body: JsonRecord) {
  const restaurantId = getRestaurantId(body);
  const customerToken = getCustomerToken(req);
  const tableNumber = normalizeTableNumber(body.tableNumber ?? body.table_number);

  const { data, error } = await supabase
    .from('waiter_calls')
    .select('id, status, created_at, updated_at, customer_token, call_type')
    .eq('restaurant_id', restaurantId)
    .eq('table_number', tableNumber)
    .eq('status', 'new')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return json({ data: mapPublicWaiterCalls(data || [], customerToken) });
}

async function getActiveWaiterCall(supabase: ReturnType<typeof createServiceClient>, req: Request, body: JsonRecord) {
  const restaurantId = getRestaurantId(body);
  const customerToken = getCustomerToken(req);
  const tableNumber = normalizeTableNumber(body.tableNumber ?? body.table_number);
  const callType = body.callType || body.call_type || body.waiterCallType || body.waiter_call_type || body.type || body.reason ? getWaiterCallType(body) : null;

  let query = supabase
    .from('waiter_calls')
    .select('id, status, created_at, updated_at, customer_token, call_type')
    .eq('restaurant_id', restaurantId)
    .eq('table_number', tableNumber)
    .eq('status', 'new')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (callType) query = query.eq('call_type', callType);

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  if (!data) return json({ data: null });

  return json({ data: publicWaiterCall(data, customerToken) });
}

async function callWaiter(supabase: ReturnType<typeof createServiceClient>, req: Request, body: JsonRecord) {
  const restaurantId = getRestaurantId(body);
  const customerToken = getCustomerToken(req);
  const tableNumber = normalizeTableNumber(body.tableNumber ?? body.table_number);
  const callType = getWaiterCallType(body);
  const cooldownCutoff = new Date(Date.now() - WAITER_COOLDOWN_SECONDS * 1000).toISOString();

  const { data: activeCall, error: activeCallError } = await supabase
    .from('waiter_calls')
    .select('id, status, created_at, updated_at, customer_token, call_type')
    .eq('restaurant_id', restaurantId)
    .eq('table_number', tableNumber)
    .eq('call_type', callType)
    .eq('status', 'new')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeCallError) throw activeCallError;
  if (activeCall) {
    return json({ data: publicWaiterCall(activeCall, customerToken), meta: { alreadyActive: true, cooldownSeconds: WAITER_COOLDOWN_SECONDS } });
  }

  const { count, error: countError } = await supabase
    .from('waiter_calls')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('table_number', tableNumber)
    .eq('call_type', callType)
    .gte('created_at', cooldownCutoff);

  if (countError) throw countError;
  if ((count || 0) >= WAITER_MAX_CALLS_PER_WINDOW) {
    return errorResponse('Kjo tavolinë mund ta dërgojë të njëjtën thirrje maksimum 2 herë brenda 60 sekondave.', 429);
  }

  const { data, error } = await supabase
    .from('waiter_calls')
    .insert({
      restaurant_id: restaurantId,
      table_number: tableNumber,
      customer_token: customerToken,
      status: 'new',
      call_type: callType,
    })
    .select('id, status, created_at, updated_at, call_type')
    .single();

  if (error) throw error;
  return json({ data: { ...data, can_cancel: true }, meta: { cooldownSeconds: WAITER_COOLDOWN_SECONDS, maxCallsPerWindow: WAITER_MAX_CALLS_PER_WINDOW } });
}

async function cancelWaiterCall(supabase: ReturnType<typeof createServiceClient>, req: Request, body: JsonRecord) {
  const restaurantId = getRestaurantId(body);
  const customerToken = getCustomerToken(req);
  const tableNumber = normalizeTableNumber(body.tableNumber ?? body.table_number);
  const callId = parsePositiveInt(body.id, 0);

  if (!callId) throw new Error('Invalid waiter call id');

  const { data, error } = await supabase
    .from('waiter_calls')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', callId)
    .eq('restaurant_id', restaurantId)
    .eq('table_number', tableNumber)
    .eq('customer_token', customerToken)
    .eq('status', 'new')
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) return errorResponse('Thirrja nuk mund të anulohet më.', 400);

  return json({ data: true });
}

async function rateOrder(supabase: ReturnType<typeof createServiceClient>, req: Request, body: JsonRecord) {
  const restaurantId = getRestaurantId(body);
  const customerToken = getCustomerToken(req);
  const orderId = parsePositiveInt(body.orderId, 0);
  const rating = String(body.rating || '').trim();

  if (!orderId) throw new Error('Invalid order id');
  if (!ALLOWED_RATINGS.has(rating)) throw new Error('Invalid rating');

  const { data, error } = await supabase
    .from('orders')
    .update({ rating })
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId)
    .eq('customer_token', customerToken)
    .eq('status', 'done')
    .is('rating', null)
    .is('deleted_at', null)
    .select('id, rating')
    .maybeSingle();

  if (error) throw error;
  if (!data) return errorResponse('Order not found or rating already submitted', 400);

  return json({ data });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    const supabase = createServiceClient();
    const body = await readJson(req);
    const action = String(body.action || '').trim();

    switch (action) {
      case 'getMenu':
        return await getMenu(supabase, body);
      case 'createOrder':
        return await createOrder(supabase, req, body);
      case 'getOrders':
        return await getOrders(supabase, req, body);
      case 'getActiveWaiterCalls':
        return await getActiveWaiterCalls(supabase, req, body);
      case 'getActiveWaiterCall':
        return await getActiveWaiterCall(supabase, req, body);
      case 'callWaiter':
        return await callWaiter(supabase, req, body);
      case 'cancelWaiterCall':
        return await cancelWaiterCall(supabase, req, body);
      case 'rateOrder':
        return await rateOrder(supabase, req, body);
      default:
        return errorResponse('Unknown action', 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
