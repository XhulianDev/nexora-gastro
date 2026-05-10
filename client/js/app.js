import { API, ACTIONS, SELECTORS } from './constants.js';
import {
  getActiveOrderIdsFromStorage,
  setActiveOrderIdsToStorage,
  getActiveWaiterCallForTable,
  setActiveWaiterCallForTable,
  getStatusUrl
} from './utils.js';
import { state, findMenuItemById } from './state.js';
import { fetchActiveMenu, submitOrder, fetchActiveOrders, insertWaiterCall, cancelWaiterCall, fetchActiveWaiterCall } from './api.js';
import * as ui from './ui.js';

document.addEventListener('DOMContentLoaded', bootstrap);

async function bootstrap() {
  ui.setTableLabel();
  injectWaiterButton();
  bindStaticEvents();
  await initMenu();
  await syncStatus();
  window.setInterval(syncStatus, API.REFRESH_INTERVAL);
}

function bindStaticEvents() {
  document.addEventListener('click', handleGlobalClicks);
  const overlay = document.querySelector(SELECTORS.overlay);
  overlay?.addEventListener('click', (event) => {
    if (event.target === overlay) ui.closeModal();
  });
}

function handleGlobalClicks(event) {
  const target = event.target;

  const catBtn = target.closest('[data-category]:not([data-action="view-category"])');
  if (catBtn) {
    state.activeCategory = catBtn.dataset.category;
    ui.renderCategories();
    ui.renderMenu();
    return;
  }

  const viewCatBtn = target.closest(`[data-action="${ACTIONS.VIEW_CATEGORY}"]`);
  if (viewCatBtn) {
    ui.navigateToCategory(viewCatBtn.dataset.category);
    return;
  }

  const qtyBtn = target.closest(`[data-action="${ACTIONS.CHANGE_QTY}"]`);
  if (qtyBtn) {
    changeQty(qtyBtn.dataset.itemId, Number.parseInt(qtyBtn.dataset.delta, 10));
    return;
  }

  const upsellBtn = target.closest(`[data-action="${ACTIONS.UPSELL_ADD}"]`);
  if (upsellBtn) {
    changeQty(upsellBtn.dataset.itemId, 1);
    return;
  }

  if (target.closest(SELECTORS.cartOpenButton)) {
    ui.openModal();
    return;
  }

  const sendOrderBtn = target.closest(`[data-action="${ACTIONS.SEND_ORDER}"]`);
  if (sendOrderBtn) {
    sendOrder();
    return;
  }

  const toggleHubBtn = target.closest(`[data-action="${ACTIONS.TOGGLE_HUB}"]`);
  if (toggleHubBtn) {
    event.stopPropagation();
    ui.toggleHubDropdown();
    return;
  }

  const viewAllStatusBtn = target.closest(`[data-action="${ACTIONS.VIEW_ALL_STATUS}"]`);
  if (viewAllStatusBtn) {
    window.location.href = getStatusUrl('?all=true');
    return;
  }

  const hubDrop = document.querySelector('#hub-drop');
  if (hubDrop?.classList.contains('is-open') && !target.closest('.status-hub')) {
    hubDrop.classList.remove('is-open');
  }
}

async function initMenu() {
  try {
    state.menu = await fetchActiveMenu();
    ui.renderCategories();
    ui.renderMenu();
    ui.updateCartBar();
  } catch (error) {
    console.error('Gabim në menunë:', error);
    ui.showToast('Gabim në ngarkimin e menysë. Provoni sërish.', 'error');
  }
}

function changeQty(itemId, delta) {
  const currentQty = state.cart[itemId] || 0;
  const nextQty = currentQty + delta;

  if (nextQty <= 0) delete state.cart[itemId];
  else state.cart[itemId] = nextQty;

  ui.updateCartBar();
  ui.renderMenu();

  const isModalOpen = document.querySelector(SELECTORS.overlay)?.classList.contains('is-visible');
  if (!isModalOpen) return;

  if (Object.keys(state.cart).length === 0) ui.closeModal();
  else ui.renderModalContent();
}

async function sendOrder() {
  const sendBtn = document.querySelector('#send-btn');
  const noteField = document.querySelector('#note');
  if (!sendBtn || sendBtn.disabled) return;

  const items = Object.entries(state.cart)
    .map(([id, qty]) => {
      const item = findMenuItemById(id);
      return item ? { id: item.id, qty } : null;
    })
    .filter(Boolean);

  if (items.length === 0) {
    ui.showToast('Shporta është bosh.', 'error');
    return;
  }

  sendBtn.disabled = true;
  sendBtn.textContent = 'Duke dërguar...';

  try {
    const note = noteField?.value?.trim() || '';
    const data = await submitOrder(state.tableNumber, items, note);
    const activeIds = getActiveOrderIdsFromStorage();
    const nextIds = Array.from(new Set([...activeIds, data.id]));
    setActiveOrderIdsToStorage(nextIds);

    state.cart = {};
    window.location.href = getStatusUrl(`?id=${data.id}`);
  } catch (error) {
    console.error('Dështoi dërgimi:', error);
    ui.showToast(error.message || 'Gabim gjatë dërgimit të porosisë.', 'error');
    sendBtn.disabled = false;
    sendBtn.textContent = 'DËRGO POROSINË';
  }
}

async function syncStatus() {
  const activeIds = getActiveOrderIdsFromStorage();

  try {
    if (activeIds.length) {
      const data = await fetchActiveOrders(activeIds);
      const visibleIds = (data || []).map((order) => order.id);
      if (visibleIds.length !== activeIds.length) setActiveOrderIdsToStorage(visibleIds);
      const wasOpen = document.querySelector('#hub-drop')?.classList.contains('is-open');
      ui.renderStatusHub(data || [], wasOpen);
    } else {
      ui.renderStatusHub([]);
    }

    const activeCall = await fetchActiveWaiterCall(state.tableNumber);
    setActiveWaiterCallForTable(state.tableNumber, activeCall);
    renderWaiterButton();
  } catch (error) {
    console.error('Gabim në sinkronizim:', error);
  }
}

function renderWaiterButton() {
  const btn = document.querySelector(SELECTORS.waiterButton);
  if (!btn) return;

  const activeCall = getActiveWaiterCallForTable(state.tableNumber);
  if (activeCall?.id) {
    btn.classList.add('is-active');
    if (activeCall.status === 'acknowledged') {
      btn.innerHTML = 'Kamarieri u njoftua';
      btn.disabled = true;
      return;
    }
    if (activeCall.can_cancel === false) {
      btn.innerHTML = 'Kamarieri u thirr';
      btn.disabled = true;
      return;
    }
    btn.innerHTML = 'Anulo thirrjen';
    btn.disabled = false;
    return;
  }

  btn.classList.remove('is-active');
  btn.innerHTML = 'Kamarieri';
  btn.disabled = false;
}

async function callWaiter() {
  const btn = document.querySelector(SELECTORS.waiterButton);
  if (!btn || btn.disabled) return;

  const activeCall = getActiveWaiterCallForTable(state.tableNumber);

  if (activeCall?.id) {
    btn.disabled = true;
    btn.innerHTML = 'Duke anuluar...';

    try {
      await cancelWaiterCall(activeCall.id, state.tableNumber);
      setActiveWaiterCallForTable(state.tableNumber, null);
      ui.showToast('Thirrja u anulua.', 'success');
    } catch (error) {
      console.error('Gabim në anulim:', error);
      setActiveWaiterCallForTable(state.tableNumber, null);
      ui.showToast(error.message || 'Thirrja nuk mund të anulohet më.', 'error');
    } finally {
      renderWaiterButton();
    }
    return;
  }

  btn.innerHTML = 'Duke thirrur...';
  btn.disabled = true;

  try {
    const result = await insertWaiterCall(state.tableNumber);
    const call = result.data;
    if (call?.id) {
      setActiveWaiterCallForTable(state.tableNumber, call);
      ui.showToast('Kamarieri u thirr me sukses. Mund ta anuloni derisa thirrja është aktive.', 'success');
    }
    renderWaiterButton();
  } catch (error) {
    console.error('Gabim kamarieri:', error);
    ui.showToast(error.message || `Mund ta thërrisni kamarierin maksimum ${API.WAITER_MAX_CALLS_PER_WINDOW} herë brenda 60 sekondave.`, 'error');
    renderWaiterButton();
  }
}

function injectWaiterButton() {
  if (document.querySelector(SELECTORS.waiterButton)) return;
  const btn = document.createElement('button');
  btn.id = SELECTORS.waiterButton.substring(1);
  btn.className = 'waiter-btn';
  btn.innerHTML = 'Kamarieri';
  btn.onclick = callWaiter;
  document.body.appendChild(btn);
  renderWaiterButton();
}
