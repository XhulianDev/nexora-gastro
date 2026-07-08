import { STORAGE } from './constants.js';

export function getTableNumberFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const table = parseInt(params.get('table'), 10);
  return Number.isFinite(table) && table > 0 && table <= 500 ? table : STORAGE.DEFAULT_TABLE;
}

export function formatMoney(value, includeCurrency = true) {
  const numericValue = parseFloat(value) || 0;
  const formatted = numericValue.toFixed(2);
  return includeCurrency ? `${formatted} €` : formatted;
}

export function escapeHtml(value) {
  if (!value) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function getActiveOrderIdsFromStorage() {
  try {
    const rawValue = localStorage.getItem(STORAGE.ACTIVE_ORDERS);
    const parsedValue = JSON.parse(rawValue || '[]');
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

export function setActiveOrderIdsToStorage(ids) {
  localStorage.setItem(STORAGE.ACTIVE_ORDERS, JSON.stringify(ids));
}

export function getCustomerToken() {
  const token = localStorage.getItem(STORAGE.CUSTOMER_TOKEN);
  return token && token.trim() ? token : null;
}

export function getOrCreateCustomerToken() {
  const existingToken = getCustomerToken();
  if (existingToken) return existingToken;

  const newToken = crypto.randomUUID();
  localStorage.setItem(STORAGE.CUSTOMER_TOKEN, newToken);
  return newToken;
}

export function getStatusUrl(query = '') {
  return `/status/${query}`;
}

export function getActiveWaiterCallsFromStorage() {
  try {
    const rawValue = localStorage.getItem(STORAGE.ACTIVE_WAITER_CALLS);
    const parsedValue = JSON.parse(rawValue || '{}');
    return parsedValue && typeof parsedValue === 'object' && !Array.isArray(parsedValue) ? parsedValue : {};
  } catch {
    return {};
  }
}

export function normalizeWaiterCallType(value) {
  return String(value || 'help') === 'payment' ? 'payment' : 'help';
}

export function getActiveWaiterCallsForTable(tableNumber) {
  const calls = getActiveWaiterCallsFromStorage();
  const tableCalls = calls[String(tableNumber)];

  if (!tableCalls) return {};

  // Backward compatibility with older storage format: table -> single call.
  if (tableCalls.id) {
    const type = normalizeWaiterCallType(tableCalls.call_type);
    return { [type]: tableCalls };
  }

  return tableCalls && typeof tableCalls === 'object' && !Array.isArray(tableCalls) ? tableCalls : {};
}

export function getActiveWaiterCallForTable(tableNumber, callType = 'help') {
  const tableCalls = getActiveWaiterCallsForTable(tableNumber);
  return tableCalls[normalizeWaiterCallType(callType)] || null;
}

export function setActiveWaiterCallsForTable(tableNumber, callsForTable) {
  const calls = getActiveWaiterCallsFromStorage();
  const nextCalls = {};

  const source = Array.isArray(callsForTable)
    ? callsForTable
    : Object.values(callsForTable || {});

  for (const call of source) {
    if (!call?.id || call.status !== 'new') continue;
    nextCalls[normalizeWaiterCallType(call.call_type)] = call;
  }

  if (Object.keys(nextCalls).length) calls[String(tableNumber)] = nextCalls;
  else delete calls[String(tableNumber)];

  localStorage.setItem(STORAGE.ACTIVE_WAITER_CALLS, JSON.stringify(calls));
}

export function setActiveWaiterCallForTable(tableNumber, call, callType = 'help') {
  const tableCalls = getActiveWaiterCallsForTable(tableNumber);
  const type = normalizeWaiterCallType(call?.call_type || callType);

  if (call?.id && call.status === 'new') tableCalls[type] = { ...call, call_type: type };
  else delete tableCalls[type];

  setActiveWaiterCallsForTable(tableNumber, tableCalls);
}
