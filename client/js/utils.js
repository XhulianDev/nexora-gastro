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
  const basePath = window.location.pathname.includes('/client/') ? '../status/' : 'status/';
  return `${basePath}${query}`;
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

export function getActiveWaiterCallForTable(tableNumber) {
  const calls = getActiveWaiterCallsFromStorage();
  return calls[String(tableNumber)] || null;
}

export function setActiveWaiterCallForTable(tableNumber, call) {
  const calls = getActiveWaiterCallsFromStorage();
  if (call?.id) calls[String(tableNumber)] = call;
  else delete calls[String(tableNumber)];
  localStorage.setItem(STORAGE.ACTIVE_WAITER_CALLS, JSON.stringify(calls));
}
