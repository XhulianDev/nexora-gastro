import { CONFIG } from './config.js';
import * as utils from './utils.js';
import * as ui from './ui.js';

const customerToken = localStorage.getItem(CONFIG.customerTokenStorageKey) || '';

const state = {
  orderId: utils.parsePositiveInteger(new URLSearchParams(window.location.search).get('id')),
  showAll: new URLSearchParams(window.location.search).get('all') === 'true',
  tableNumber: null,
  isInitialLoad: true,
  activeCalls: {},
};

const elements = {
  mainContent: document.getElementById('main-content'),
  backButton: document.getElementById('btn-back'),
  waiterRow: document.getElementById('waiter-action-row'),
  waiterToggle: document.getElementById('waiter-menu-toggle'),
  waiterMenu: document.getElementById('waiter-action-menu'),
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
  document.addEventListener('click', handleDocumentClick);
  elements.mainContent?.addEventListener('click', handleActionClicks);
}

function handleDocumentClick(event) {
  const target = event.target;

  const toggleBtn = target.closest('[data-action="toggle-waiter-menu"]');
  if (toggleBtn) {
    event.stopPropagation();
    toggleWaiterMenu();
    return;
  }

  const callBtn = target.closest('[data-action="call-waiter"]');
  if (callBtn) {
    event.preventDefault();
    event.stopPropagation();
    handleWaiterCall(callBtn.dataset.callType || callBtn.dataset.call_type || 'help');
    return;
  }

  if (elements.waiterMenu && !elements.waiterMenu.hidden && !target.closest('.waiter-action-row')) {
    closeWaiterMenu();
  }
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
    await syncWaiterCalls();
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
  ui.toggleElement(elements.waiterRow, !!state.tableNumber);

  if (orders.length === 1 && !state.showAll) {
    elements.mainContent.classList.add('single-mode');
    elements.mainContent.innerHTML = ui.renderOrderCard(orders[0], activeIds.indexOf(orders[0].id) + 1, isBusy);
    return;
  }

  elements.mainContent.classList.remove('single-mode');
  elements.mainContent.innerHTML = ui.renderMultipleOrders(orders, activeIds, isBusy);
}

function normalizeCallType(value) {
  return String(value || 'help') === 'payment' ? 'payment' : 'help';
}

function getCallTypeLabel(type) {
  return normalizeCallType(type) === 'payment' ? 'Pagesë' : 'Ndihmë';
}

function getCallTypeCancelLabel(type) {
  return normalizeCallType(type) === 'payment' ? 'Anulo pagesën' : 'Anulo ndihmën';
}

function setActiveCalls(calls = []) {
  const next = {};
  for (const call of Array.isArray(calls) ? calls : []) {
    if (!call?.id || call.status !== 'new') continue;
    next[normalizeCallType(call.call_type)] = call;
  }
  state.activeCalls = next;
}

async function syncWaiterCalls() {
  if (!state.tableNumber) return;

  try {
    const result = await callCustomerApi('getActiveWaiterCalls', { tableNumber: state.tableNumber });
    setActiveCalls(result.data || []);
  } catch (error) {
    console.warn('[Status waiter calls] Sync failed:', error);
  }

  renderWaiterButtons();
}

function closeWaiterMenu() {
  if (!elements.waiterMenu || !elements.waiterToggle) return;
  elements.waiterMenu.hidden = true;
  elements.waiterToggle.setAttribute('aria-expanded', 'false');
}

function toggleWaiterMenu() {
  if (!elements.waiterMenu || !elements.waiterToggle) return;
  const nextOpen = elements.waiterMenu.hidden;
  elements.waiterMenu.hidden = !nextOpen;
  elements.waiterToggle.setAttribute('aria-expanded', String(nextOpen));
  if (nextOpen) renderWaiterButtons();
}

function getWaiterButtons(type = null) {
  const selector = type
    ? `[data-action="call-waiter"][data-call-type="${normalizeCallType(type)}"]`
    : '[data-action="call-waiter"]';
  return [...document.querySelectorAll(selector)];
}

function renderWaiterButtons() {
  const buttons = getWaiterButtons();
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    const type = normalizeCallType(btn.dataset.callType);
    const activeCall = state.activeCalls[type];
    btn.classList.toggle('is-active', Boolean(activeCall?.id));

    if (activeCall?.id) {
      if (activeCall.can_cancel === false) {
        btn.textContent = `${getCallTypeLabel(type)} u dërgua`;
        btn.disabled = true;
        return;
      }

      btn.textContent = getCallTypeCancelLabel(type);
      btn.disabled = false;
      return;
    }

    btn.textContent = getCallTypeLabel(type);
    btn.disabled = false;
  });
}

async function handleWaiterCall(callType = 'help') {
  if (!state.tableNumber) return;

  const type = normalizeCallType(callType);
  const buttons = getWaiterButtons(type);
  if (buttons.some((btn) => btn.disabled)) return;

  const activeCall = state.activeCalls[type];

  buttons.forEach((btn) => {
    btn.disabled = true;
    btn.textContent = activeCall?.id ? 'Duke anuluar...' : 'Duke dërguar...';
  });

  try {
    if (activeCall?.id) {
      await callCustomerApi('cancelWaiterCall', { id: activeCall.id, tableNumber: state.tableNumber });
      delete state.activeCalls[type];
      renderWaiterButtons();
      return;
    }

    const result = await callCustomerApi('callWaiter', { tableNumber: state.tableNumber, callType: type, call_type: type });
    if (result.data?.id) state.activeCalls[type] = result.data;
    renderWaiterButtons();
  } catch (error) {
    console.error('Waiter call failed:', error);
    renderWaiterButtons();
  }
}

function handleBackNavigation() {
  const target = state.tableNumber ? `/client/?table=${state.tableNumber}` : '/client/';
  window.location.href = target;
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
