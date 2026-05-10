import { CONFIG } from './config.js';
import * as utils from './utils.js';
import * as ui from './ui.js';

const customerToken = localStorage.getItem(CONFIG.customerTokenStorageKey) || '';

const state = {
  orderId: utils.parsePositiveInteger(new URLSearchParams(window.location.search).get('id')),
  showAll: new URLSearchParams(window.location.search).get('all') === 'true',
  tableNumber: null,
  isInitialLoad: true,
};

const elements = {
  mainContent: document.getElementById('main-content'),
  backButton: document.getElementById('btn-back'),
  waiterButton: document.getElementById('waiter-btn'),
};

document.addEventListener('DOMContentLoaded', () => {
  initEvents();
  refreshCycle();
  window.setInterval(refreshCycle, CONFIG.statusRefreshIntervalMs);
});

function getCustomerHeaders() {
  return {
    Authorization: `Bearer ${CONFIG.supabaseKey}`,
    apikey: CONFIG.supabaseKey,
    'Content-Type': 'application/json',
    'x-customer-token': customerToken,
  };
}

async function callCustomerApi(action, payload = {}) {
  const response = await fetch(`${CONFIG.supabaseUrl}/functions/v1/customer-api`, {
    method: 'POST',
    headers: getCustomerHeaders(),
    body: JSON.stringify({ action, restaurantId: CONFIG.restaurantId, ...payload }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || `Customer API failed with ${response.status}`);
  }

  return result;
}

function initEvents() {
  elements.backButton?.addEventListener('click', handleBackNavigation);
  elements.waiterButton?.addEventListener('click', handleWaiterCall);
  elements.mainContent?.addEventListener('click', handleActionClicks);
}

async function refreshCycle() {
  if (!customerToken) {
    ui.renderEmptyState(elements.mainContent, 'Sesioni i porosisë nuk u gjet në këtë pajisje.');
    return;
  }

  const activeIds = utils.getActiveOrderIds(CONFIG.activeOrdersStorageKey);
  const idsToFetch = state.showAll ? activeIds : (state.orderId ? [state.orderId] : []);

  if (idsToFetch.length === 0) {
    ui.renderEmptyState(elements.mainContent, 'Nuk u gjet asnjë porosi aktive.');
    return;
  }

  try {
    const result = await callCustomerApi('getOrders', { ids: idsToFetch });
    updateUI(result.data || [], activeIds, Boolean(result.meta?.isBusy));
  } catch (error) {
    console.error('[Status Error] Fetch failed:', error);
    if (state.isInitialLoad) {
      ui.renderEmptyState(elements.mainContent, error.message || 'Gabim gjatë lidhjes me serverin.');
    }
  } finally {
    state.isInitialLoad = false;
  }
}

function updateUI(orders, activeIds, isBusy) {
  if (!orders || orders.length === 0) {
    ui.renderEmptyState(elements.mainContent, 'Porosia nuk u gjet.');
    return;
  }

  state.tableNumber = orders[0].table_number;
  ui.toggleElement(elements.backButton, true);
  ui.toggleElement(elements.waiterButton, !!state.tableNumber);

  if (orders.length === 1 && !state.showAll) {
    elements.mainContent.classList.add('single-mode');
    elements.mainContent.innerHTML = ui.renderOrderCard(orders[0], activeIds.indexOf(orders[0].id) + 1, isBusy);
    return;
  }

  elements.mainContent.classList.remove('single-mode');
  elements.mainContent.innerHTML = ui.renderMultipleOrders(orders, activeIds, isBusy);
}

function handleBackNavigation() {
  const target = state.tableNumber ? `../index.html?table=${state.tableNumber}` : '../index.html';
  window.location.href = target;
}

async function handleWaiterCall() {
  if (!state.tableNumber || elements.waiterButton.disabled) return;

  ui.setWaiterLoading(elements.waiterButton, true);

  try {
    await callCustomerApi('callWaiter', { tableNumber: state.tableNumber });
    setTimeout(() => ui.setWaiterLoading(elements.waiterButton, false), CONFIG.waiterCooldownMs);
  } catch (error) {
    console.error('Waiter call failed:', error);
    ui.setWaiterLoading(elements.waiterButton, false);
  }
}

async function handleActionClicks(event) {
  const ratingBtn = event.target.closest('[data-action="send-rating"]');
  if (!ratingBtn) return;

  const orderId = utils.parsePositiveInteger(ratingBtn.dataset.orderId);
  const rating = String(ratingBtn.dataset.rating || '').trim();
  if (!orderId || !rating) return;

  ui.updateRatingUI(orderId, 'loading');

  try {
    await callCustomerApi('rateOrder', { orderId, rating });
    ui.updateRatingUI(orderId, 'success');
  } catch {
    ui.updateRatingUI(orderId, 'error');
  }
}
