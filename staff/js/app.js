import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CONFIG } from '../../admin/js/config.js';

const RESTAURANT_ID = 1;
const DEVICE_ID_KEY = 'smartmenu_staff_device_id';
const SESSION_KEY = 'smartmenu_staff_session';
const SESSION_EXP_KEY = 'smartmenu_staff_session_expires_at';
const ZONES = [
  { id: 'all', label: 'Të gjitha', range: '' },
  { id: 'A', label: 'Zona A', range: '1–5' },
  { id: 'B', label: 'Zona B', range: '6–10' },
  { id: 'C', label: 'Zona C', range: '11–15' },
];

const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

const state = {
  deviceId: getOrCreateDeviceId(),
  sessionToken: localStorage.getItem(SESSION_KEY) || '',
  sessionExpiresAt: localStorage.getItem(SESSION_EXP_KEY) || '',
  orders: [],
  calls: [],
  activeZone: 'all',
  sessionWarningShown: false,
  sessionTimerId: null,
  sessionWarningThresholdMs: 5 * 60 * 1000,
  pendingApprovalTimerId: null,
  fallbackPollingId: null,
  pendingLoginPayload: null,
};

const $ = (id) => document.getElementById(id);

function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = 'staff-' + crypto.randomUUID() + '-' + Date.now();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function detectDeviceMeta() {
  const ua = navigator.userAgent || '';
  const uaData = navigator.userAgentData || null;
  const platform = uaData?.platform || navigator.platform || '';
  const isTouch = navigator.maxTouchPoints > 1;

  const browser = (() => {
    if (/Edg\//.test(ua)) return 'Edge';
    if (/OPR\//.test(ua)) return 'Opera';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/Chrome\//.test(ua) || /CriOS\//.test(ua)) return 'Chrome';
    if (/Safari\//.test(ua)) return 'Safari';
    return 'Browser';
  })();

  const os = (() => {
    if (/Android/i.test(ua)) return 'Android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
    if (/Windows/i.test(ua)) return 'Windows';
    if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS';
    if (/Linux/i.test(ua) || /X11/i.test(ua)) return 'Linux';
    return platform || 'Unknown OS';
  })();

  const type = (() => {
    if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && isTouch)) return 'tablet';
    if (/Tablet|SM-T|Lenovo TB|Nexus 7|Nexus 10/i.test(ua)) return 'tablet';
    if (/Mobi|Android|iPhone|iPod/i.test(ua)) return 'phone';
    return 'desktop';
  })();

  const label = `${type.charAt(0).toUpperCase() + type.slice(1)} · ${browser} · ${os}`;
  return { type, browser, os, label, userAgent: ua.slice(0, 500) };
}

function escapeHTML(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
function formatMoney(value) { return Number(value || 0).toFixed(2) + ' €'; }
function formatTime(value) { return value ? new Date(value).toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' }) : '-'; }
function parseItems(value) { if (Array.isArray(value)) return value; try { return JSON.parse(value || '[]'); } catch { return []; } }
function getZone(tableNumber) { const table = Number.parseInt(String(tableNumber || 0), 10); if (table >= 1 && table <= 5) return { id: 'A', label: 'Zona A' }; if (table >= 6 && table <= 10) return { id: 'B', label: 'Zona B' }; return { id: 'C', label: 'Zona C' }; }
function withZone(record) { if (record.zone?.label) return { ...record, zone_id: String(record.zone.label).replace('Zona ', ''), zone_label: record.zone.label }; const zone = getZone(record.table_number); return { ...record, zone_id: zone.id, zone_label: zone.label }; }
function filterByZone(records) { const items = records.map(withZone); return state.activeZone === 'all' ? items : items.filter((record) => record.zone_id === state.activeZone); }
function sessionValid() { return Boolean(state.sessionToken && state.sessionExpiresAt && new Date(state.sessionExpiresAt).getTime() > Date.now()); }
function sessionMsLeft() { return state.sessionExpiresAt ? new Date(state.sessionExpiresAt).getTime() - Date.now() : 0; }
function formatCountdown(ms) {
  const safe = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(safe / 60);
  const seconds = String(safe % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function formatElapsedSince(value) {
  if (!value) return '';
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 1) return 'Pranuar tani';
  if (minutes === 1) return 'Pranuar prej 1 min';
  return `Pranuar prej ${minutes} min`;
}

function showPersistentSessionWarning(msLeft) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = `Qasja skadon për ${formatCountdown(msLeft)}`;
  toast.className = 'toast show warning';
}

function hideSessionWarning() {
  const toast = $('toast');
  if (toast?.classList.contains('warning')) toast.className = 'toast';
}

function startSessionWatch() {
  if (state.sessionTimerId) window.clearInterval(state.sessionTimerId);
  state.sessionWarningShown = false;
  hideSessionWarning();

  const initialLeft = Math.max(sessionMsLeft(), 0);
  // For short test sessions, warn halfway through. For real/long sessions, warn 15 minutes before expiry.
  state.sessionWarningThresholdMs = initialLeft < 30 * 60 * 1000
    ? Math.max(30 * 1000, initialLeft * 0.5)
    : 15 * 60 * 1000;

  state.sessionTimerId = window.setInterval(() => {
    const left = sessionMsLeft();
    if (left <= 0) {
      hideSessionWarning();
      showToast('Qasja skadoi. Futni PIN-in përsëri.', true);
      window.clearInterval(state.sessionTimerId);
      state.sessionTimerId = null;
      logout(false);
      return;
    }

    if (left <= state.sessionWarningThresholdMs) {
      state.sessionWarningShown = true;
      showPersistentSessionWarning(left);
    }
  }, 1000);
}

function countByZone() {
  const counts = { all: 0, A: 0, B: 0, C: 0 };
  for (const item of [...state.orders, ...state.calls].map(withZone)) {
    counts.all += 1;
    if (counts[item.zone_id] != null) counts[item.zone_id] += 1;
  }
  return counts;
}

async function callApi(action, payload = {}) {
  const headers = {
    Authorization: 'Bearer ' + CONFIG.supabaseKey,
    apikey: CONFIG.supabaseKey,
    'Content-Type': 'application/json',
  };
  if (action !== 'staffLogin') {
    headers['x-staff-device-id'] = state.deviceId;
    headers['x-staff-session'] = state.sessionToken;
  }
  const response = await fetch(CONFIG.supabaseUrl + '/functions/v1/admin-api', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, restaurantId: RESTAURANT_ID, ...payload }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.message || result.error || 'Request failed');
    error.code = result.error;
    throw error;
  }
  return result;
}

async function refreshData() {
  const [ordersRes, callsRes] = await Promise.all([
    callApi('getStaffOrders'),
    callApi('getStaffCalls'),
  ]);
  state.orders = ordersRes.data || [];
  state.calls = callsRes.data || [];
  render();
}

function renderZoneFilter() {
  const counts = countByZone();
  $('zone-filter').innerHTML = ZONES.map((zone) => `
    <button class="zone-chip ${state.activeZone === zone.id ? 'active' : ''}" data-zone="${zone.id}" type="button">
      <span>${escapeHTML(zone.label)}${zone.range ? ` <small>${escapeHTML(zone.range)}</small>` : ''}</span><strong>${counts[zone.id] || 0}</strong>
    </button>
  `).join('');
}

function groupCallsByTable(calls) {
  const grouped = new Map();
  for (const call of calls.map(withZone)) {
    const table = String(call.table_number || '-');
    if (!grouped.has(table)) grouped.set(table, []);
    grouped.get(table).push(call);
  }
  return [...grouped.entries()].map(([table, calls]) => ({ table, calls, latest: calls[0], zone: calls[0].zone_label }));
}

function getCallLabel(call) {
  return call.status === 'acknowledged' ? 'Pranuar' : 'E re';
}

function getCallStatusClass(call) {
  return call.status === 'acknowledged' ? 'status-preparing' : 'status-new';
}

function getCallTimeMeta(call) {
  if (call.status === 'acknowledged') return formatElapsedSince(call.updated_at || call.created_at);
  return `E dërguar ${formatTime(call.created_at)}`;
}

function getCallActions(call) {
  if (call.status === 'acknowledged') {
    return `<button class="call-action-close" data-action="archive-call" data-id="${call.id}" type="button">Mbyll</button>`;
  }
  return `<button class="call-action-ack" data-action="ack-call" data-id="${call.id}" type="button">Prano</button>`;
}

function renderCalls() {
  const calls = filterByZone(state.calls);
  $('calls-count').textContent = calls.length;
  if (!calls.length) { $('calls-container').innerHTML = '<div class="empty">Nuk ka thirrje në këtë zonë.</div>'; return; }
  $('calls-container').innerHTML = groupCallsByTable(calls).map((group) => {
    const latest = group.latest;
    return `
      <article class="call-card call-card--${escapeHTML(latest.status || 'new')}">
        <header class="call-card-header">
          <div>
            <h3>Tavolina ${escapeHTML(group.table)}</h3>
            <p>${escapeHTML(group.zone)} · ${group.calls.length === 1 ? '1 thirrje' : `${group.calls.length} thirrje`} · ${formatTime(latest.created_at)}</p>
          </div>
          <span class="call-status ${getCallStatusClass(latest)}">${getCallLabel(latest)}</span>
        </header>
        <div class="call-card-body">
          ${group.calls.map((call) => `
            <div class="call-row call-row--${escapeHTML(call.status || 'new')}">
              <div>
                <strong>${getCallLabel(call)}</strong>
                <span>${escapeHTML(getCallTimeMeta(call))}</span>
              </div>
              ${getCallActions(call)}
            </div>
          `).join('')}
        </div>
      </article>
    `;
  }).join('');
}

function getStatusButton(order) {
  if (order.status === 'new') return `<button class="btn-next-preparing" data-action="status" data-id="${order.id}" data-status="preparing" type="button">Në përgatitje</button>`;
  if (order.status === 'preparing') return `<button class="btn-next-done" data-action="status" data-id="${order.id}" data-status="done" type="button">E gatshme</button>`;
  return '';
}

function renderOrders() {
  const orders = filterByZone(state.orders);
  $('orders-count').textContent = orders.length;
  if (!orders.length) { $('orders-container').innerHTML = '<div class="empty">Nuk ka porosi aktive në këtë zonë.</div>'; return; }
  $('orders-container').innerHTML = orders.map((order) => {
    const items = parseItems(order.items);
    const canClose = order.status === 'done';
    return `
      <article class="order-card status-${escapeHTML(order.status)}">
        <header><div><h3>Porosia #${escapeHTML(order.id)}</h3><p>Tavolina ${escapeHTML(order.table_number)} · ${escapeHTML(order.zone_label)} · ${formatTime(order.created_at)}</p></div><span>${escapeHTML(order.status)}</span></header>
        <div class="items">${items.map((item) => `<div><span>${escapeHTML(item.qty || 1)}× ${escapeHTML(item.name || 'Artikull')}</span><strong>${formatMoney((item.qty || 1) * (item.price || 0))}</strong></div>`).join('')}</div>
        ${order.note ? `<p class="note">${escapeHTML(order.note)}</p>` : ''}
        <footer><strong>${formatMoney(order.total)}</strong><div>${getStatusButton(order)}${canClose ? `<button class="outline danger" data-action="archive-order" data-id="${order.id}" type="button">Arkivo</button>` : ''}</div></footer>
      </article>
    `;
  }).join('');
}

function render() { renderZoneFilter(); renderCalls(); renderOrders(); updateBulkActions(); }

function updateScreenMode() {
  document.body.classList.toggle('is-login-mode', Boolean($('login-card') && !$('login-card').hidden));
}
function showToast(message, isError = false) { const toast = $('toast'); toast.textContent = message; toast.className = 'toast show ' + (isError ? 'error' : ''); setTimeout(() => { if (!toast.classList.contains('warning')) toast.className = 'toast'; }, 2500); }

function confirmAction({ title = 'A jeni i sigurt?', message = '', confirmText = 'Konfirmo' } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box" role="dialog" aria-modal="true">
        <h3>${escapeHTML(title)}</h3>
        <p>${escapeHTML(message)}</p>
        <div class="confirm-actions">
          <button class="ghost-btn" data-confirm="cancel" type="button">Anulo</button>
          <button class="ghost-btn danger" data-confirm="ok" type="button">${escapeHTML(confirmText)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const onKeydown = (event) => { if (event.key === 'Escape') cleanup(false); };
    const cleanup = (value) => {
      document.removeEventListener('keydown', onKeydown);
      overlay.remove();
      resolve(value);
    };
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay || event.target.closest('[data-confirm="cancel"]')) cleanup(false);
      if (event.target.closest('[data-confirm="ok"]')) cleanup(true);
    });
    document.addEventListener('keydown', onKeydown);
    overlay.querySelector('[data-confirm="cancel"]')?.focus();
  });
}

function getVisibleOrders() {
  return filterByZone(state.orders);
}

function getVisibleCalls() {
  return filterByZone(state.calls);
}

function getBulkLabel() {
  return state.activeZone === 'all' ? 'në të gjitha zonat' : `në ${ZONES.find((zone) => zone.id === state.activeZone)?.label || 'këtë zonë'}`;
}

function orderArchiveMessage(count) {
  return count === 1
    ? `Do të arkivohet 1 porosi e kryer ${getBulkLabel()}.`
    : `Do të arkivohen ${count} porosi të kryera ${getBulkLabel()}.`;
}

function callCloseMessage(count) {
  return count === 1
    ? `Do të mbyllet 1 thirrje ${getBulkLabel()}.`
    : `Do të mbyllen ${count} thirrje ${getBulkLabel()}.`;
}

function archivedOrdersToast(count) {
  return count === 1 ? '1 porosi u arkivua.' : `${count} porosi u arkivuan.`;
}

function closedCallsToast(count) {
  return count === 1 ? '1 thirrje u mbyll.' : `${count} thirrje u mbyllën.`;
}

function updateBulkActions() {
  const doneCount = getVisibleOrders().filter((order) => order.status === 'done').length;
  const callsCount = getVisibleCalls().length;
  const archiveBtn = $('bulk-archive-done-btn');
  const callsBtn = $('bulk-clear-calls-btn');
  if (archiveBtn) {
    archiveBtn.textContent = `Arkivo të gatshmet (${doneCount})`;
    archiveBtn.disabled = doneCount === 0;
  }
  if (callsBtn) {
    callsBtn.textContent = `Mbyll thirrjet (${callsCount})`;
    callsBtn.disabled = callsCount === 0;
  }
}

async function archiveVisibleDoneOrders() {
  const ids = getVisibleOrders().filter((order) => order.status === 'done').map((order) => order.id);
  if (!ids.length) return showToast('Nuk ka porosi të kryera për arkivim.');
  if (!await confirmAction({ title: 'Arkivo porositë e kryera?', message: orderArchiveMessage(ids.length), confirmText: 'Arkivo' })) return;
  const res = await callApi('staffArchiveDoneOrders', { ids });
  showToast(archivedOrdersToast(res.data?.count || 0));
  await refreshData();
}

async function clearVisibleCalls() {
  const ids = getVisibleCalls().map((call) => call.id);
  if (!ids.length) return showToast('Nuk ka thirrje për mbyllje.');
  if (!await confirmAction({ title: 'Mbyll thirrjet?', message: callCloseMessage(ids.length), confirmText: 'Mbyll' })) return;
  const res = await callApi('staffArchiveWaiterCalls', { ids });
  showToast(closedCallsToast(res.data?.count || 0));
  await refreshData();
}

function stopPendingApprovalWatch() {
  if (state.pendingApprovalTimerId) window.clearInterval(state.pendingApprovalTimerId);
  state.pendingApprovalTimerId = null;
}

function startPendingApprovalWatch() {
  stopPendingApprovalWatch();
  state.pendingApprovalTimerId = window.setInterval(async () => {
    if (!state.pendingLoginPayload) return;
    try {
      const res = await callApi('staffLogin', state.pendingLoginPayload);
      stopPendingApprovalWatch();
      state.pendingLoginPayload = null;
      $('pending-box').hidden = true;
      $('login-error').textContent = '';
      await openStaffSession(res);
    } catch (error) {
      if (error.code !== 'DEVICE_PENDING') {
        stopPendingApprovalWatch();
        $('login-error').textContent = error.message || 'Hyrja dështoi.';
      }
    }
  }, 3000);
}

async function openStaffSession(res) {
  state.sessionToken = res.data.sessionToken;
  state.sessionExpiresAt = res.data.sessionExpiresAt;
  localStorage.setItem(SESSION_KEY, state.sessionToken);
  localStorage.setItem(SESSION_EXP_KEY, state.sessionExpiresAt);
  $('login-card').hidden = true;
  $('staff-app').hidden = false;
  updateScreenMode();
  startSessionWatch();
  startFallbackPolling();
  await refreshData();
}

async function login() {
  const pin = $('staff-pin-input').value.trim();
  const deviceMeta = detectDeviceMeta();
  if (!pin) return;
  const payload = {
    pin,
    deviceId: state.deviceId,
    deviceLabel: deviceMeta.label,
    deviceMeta,
  };

  try {
    stopPendingApprovalWatch();
    state.pendingLoginPayload = null;
    const res = await callApi('staffLogin', payload);
    await openStaffSession(res);
  } catch (error) {
    if (error.code === 'DEVICE_PENDING') {
      state.pendingLoginPayload = payload;
      $('pending-box').hidden = false;
      $('login-error').textContent = 'Pajisja pret aprovim. Faqja hapet automatikisht pas aprovimit.';
      startPendingApprovalWatch();
      return;
    }
    $('login-error').textContent = error.message || 'Hyrja dështoi.';
  }
}

function logout(reload = true) {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_EXP_KEY);
  state.sessionToken = '';
  state.sessionExpiresAt = '';
  if (state.sessionTimerId) window.clearInterval(state.sessionTimerId);
  state.sessionTimerId = null;
  if (state.fallbackPollingId) window.clearInterval(state.fallbackPollingId);
  state.fallbackPollingId = null;
  stopPendingApprovalWatch();
  state.pendingLoginPayload = null;
  hideSessionWarning();
  if (reload) window.location.reload();
  else {
    $('staff-app').hidden = true;
    $('login-card').hidden = false;
    updateScreenMode();
  }
}

function setupEvents() {
  $('staff-login-btn').addEventListener('click', login);
  $('login-card')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      login();
    }
  });
  $('logout-btn').addEventListener('click', logout);
  $('bulk-archive-done-btn')?.addEventListener('click', async () => {
    try { await archiveVisibleDoneOrders(); } catch (error) { showToast(error.message || 'Arkivimi dështoi.', true); }
  });
  $('bulk-clear-calls-btn')?.addEventListener('click', async () => {
    try { await clearVisibleCalls(); } catch (error) { showToast(error.message || 'Mbyllja e thirrjeve dështoi.', true); }
  });
  document.addEventListener('click', async (event) => {
    const zoneBtn = event.target.closest('[data-zone]');
    if (zoneBtn) { state.activeZone = zoneBtn.dataset.zone || 'all'; render(); return; }
    const actionBtn = event.target.closest('[data-action]');
    if (!actionBtn) return;
    const { action, id, status } = actionBtn.dataset;
    try {
      if (action === 'status') { await callApi('staffUpdateStatus', { orderId: id, status }); showToast('Statusi u ndryshua.'); }
      if (action === 'archive-order') { await callApi('staffArchiveOrder', { id }); showToast('Porosia u mbyll dhe u ruajt në arkiv.'); }
      if (action === 'ack-call') { await callApi('staffAcknowledgeWaiterCall', { id }); showToast('Thirrja u pranua.'); }
      if (action === 'archive-call') { await callApi('staffArchiveWaiterCall', { id }); showToast('Thirrja u mbyll.'); }
      await refreshData();
    } catch (error) { showToast(error.message || 'Veprimi dështoi.', true); }
  });
}

async function safeRefreshData() {
  try {
    await refreshData();
  } catch (error) {
    console.warn('[Staff refresh failed]', error);
    if (error.code === 'DEVICE_NOT_APPROVED' || error.code === 'DEVICE_EXPIRED' || error.code === 'SESSION_EXPIRED' || /approved|expired|session|unauthorized/i.test(error.message || '')) {
      showToast('Qasja u ndërpre. Futni PIN-in përsëri.', true);
      logout(false);
    }
  }
}

function startFallbackPolling() {
  if (state.fallbackPollingId) return;
  state.fallbackPollingId = window.setInterval(() => {
    if (sessionValid() && !$('staff-app')?.hidden) safeRefreshData();
  }, 5000);
}

function setupRealtime() {
  supabase.channel('staff-mode')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, safeRefreshData)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_calls' }, safeRefreshData)
    .subscribe();
  startFallbackPolling();
}

setupEvents();
setupRealtime();
if (sessionValid()) {
  startSessionWatch();
  safeRefreshData().then(() => { $('login-card').hidden = true; $('staff-app').hidden = false; updateScreenMode(); }).catch(logout);
} else {
  updateScreenMode();
}
