import { STORAGE } from './constants.js';

export function getTableNumberFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const table = parseInt(params.get('table'), 10);
  return Number.isFinite(table) && table > 0 ? table : STORAGE.DEFAULT_TABLE;
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
  } catch { return []; }
}

export function setActiveOrderIdsToStorage(ids) {
  localStorage.setItem(STORAGE.ACTIVE_ORDERS, JSON.stringify(ids));
}