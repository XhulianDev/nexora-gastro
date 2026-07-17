import { API, ACTIONS, SELECTORS } from './constants.js';
import {
  getActiveOrderIdsFromStorage,
  setActiveOrderIdsToStorage,
  getActiveWaiterCallForTable,
  setActiveWaiterCallForTable,
  setActiveWaiterCallsForTable,
  normalizeWaiterCallType,
  getStatusUrl
} from './utils.js';
import { state, findMenuItemById } from './state.js';
import { fetchActiveMenu, submitOrder, fetchActiveOrders, insertWaiterCall, cancelWaiterCall, fetchActiveWaiterCalls } from './api.js';
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
    renderWaiterButtons();
    return;
  }

  const sendOrderBtn = target.closest(`[data-action="${ACTIONS.SEND_ORDER}"]`);
  if (sendOrderBtn) {
    sendOrder();
    return;
  }

  const toggleWaiterMenuBtn = target.closest(`[data-action="${ACTIONS.TOGGLE_WAITER_MENU}"]`);
  if (toggleWaiterMenuBtn) {
    event.stopPropagation();
    toggleWaiterMenu();
    return;
  }

  const callWaiterBtn = target.closest(`[data-action="${ACTIONS.CALL_WAITER}"]`);
  if (callWaiterBtn) {
    event.preventDefault();
    event.stopPropagation();
    callWaiter(callWaiterBtn.dataset.callType || callWaiterBtn.dataset.call_type || 'help');
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

  const retryMenuBtn = target.closest(`[data-action="${ACTIONS.RETRY_MENU}"]`);
  if (retryMenuBtn) {
    initMenu();
    return;
  }

  const hubDrop = document.querySelector('#hub-drop');
  if (hubDrop?.classList.contains('is-open') && !target.closest('.status-hub')) {
    hubDrop.classList.remove('is-open');
  }

  const waiterMenu = document.querySelector('#waiter-action-menu');
  if (waiterMenu && !waiterMenu.hidden && !target.closest('.waiter-action-row')) {
    closeWaiterMenu();
  }
}

async function initMenu() {
  ui.renderMenuLoading();

  try {
    state.menu = await fetchActiveMenu();
    ui.renderCategories();
    ui.renderMenu();
    ui.updateCartBar();
  } catch (error) {
    console.error('Gabim në menynë:', error);
    state.menu = [];
    ui.renderCategories();
    ui.renderMenuError();
    ui.showToast('Menyja nuk u ngarkua. Provoni sërish ose thërrisni kamarierin.', 'error');
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
  else {
    ui.renderModalContent();
    renderWaiterButtons();
  }
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
    const note = (noteField?.value?.trim() || '').slice(0, API.ORDER_NOTE_MAX_LENGTH);
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

    const activeCalls = await fetchActiveWaiterCalls(state.tableNumber);
    setActiveWaiterCallsForTable(state.tableNumber, activeCalls);
    renderWaiterButtons();
  } catch (error) {
    console.error('Gabim në sinkronizim:', error);
  }
}

function closeWaiterMenu() {
  const menu = document.querySelector('#waiter-action-menu');
  const toggle = document.querySelector('#waiter-menu-toggle');
  if (!menu || !toggle) return;
  menu.hidden = true;
  toggle.setAttribute('aria-expanded', 'false');
}

function toggleWaiterMenu() {
  const menu = document.querySelector('#waiter-action-menu');
  const toggle = document.querySelector('#waiter-menu-toggle');
  if (!menu || !toggle) return;

  const nextOpen = menu.hidden;
  menu.hidden = !nextOpen;
  toggle.setAttribute('aria-expanded', String(nextOpen));
  if (nextOpen) renderWaiterButtons();
}

function getCallTypeLabel(callType) {
  return normalizeWaiterCallType(callType) === 'payment' ? 'Pagesë' : 'Ndihmë';
}

function getCallTypeCancelLabel(callType) {
  return normalizeWaiterCallType(callType) === 'payment' ? 'Anulo pagesën' : 'Anulo ndihmën';
}

function isActionableCall(call) {
  return Boolean(call?.id && call.status === 'new');
}

function renderWaiterButtons() {
  const buttons = document.querySelectorAll(SELECTORS.waiterActionButtons);
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    const type = normalizeWaiterCallType(btn.dataset.callType);
    const storedCall = getActiveWaiterCallForTable(state.tableNumber, type);
    const activeCall = isActionableCall(storedCall) ? storedCall : null;

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

async function callWaiter(callType = 'help') {
  const type = normalizeWaiterCallType(callType);
  const buttons = [...document.querySelectorAll(`${SELECTORS.waiterActionButtons}[data-call-type="${type}"]`)];
  if (buttons.some((btn) => btn.disabled)) return;

  const storedCall = getActiveWaiterCallForTable(state.tableNumber, type);
  const activeCall = isActionableCall(storedCall) ? storedCall : null;

  buttons.forEach((btn) => {
    btn.disabled = true;
    btn.textContent = activeCall?.id ? 'Duke anuluar...' : 'Duke dërguar...';
  });

  if (activeCall?.id) {
    try {
      await cancelWaiterCall(activeCall.id, state.tableNumber);
      setActiveWaiterCallForTable(state.tableNumber, null, type);
      ui.showToast('Thirrja u anulua.', 'success');
    } catch (error) {
      console.error('Gabim në anulim:', error);
      setActiveWaiterCallForTable(state.tableNumber, null, type);
      ui.showToast(error.message || 'Thirrja nuk mund të anulohet më.', 'error');
    } finally {
      renderWaiterButtons();
    }
    return;
  }

  try {
    const result = await insertWaiterCall(state.tableNumber, type);
    const call = result.data;
    if (call?.id) {
      setActiveWaiterCallForTable(state.tableNumber, call, type);
      const message = type === 'payment'
        ? 'Kërkesa për pagesë u dërgua.'
        : 'Kamarieri u thirr për ndihmë.';
      ui.showToast(message, 'success');
    }
    renderWaiterButtons();
  } catch (error) {
    console.error('Gabim kamarieri:', error);
    ui.showToast(error.message || `Mund ta thërrisni kamarierin maksimum ${API.WAITER_MAX_CALLS_PER_WINDOW} herë brenda 60 sekondave.`, 'error');
    renderWaiterButtons();
  }
}

function injectWaiterButton() {
  if (document.querySelector('.waiter-action-row')) return;

  const row = document.createElement('div');
  row.className = 'waiter-action-row';
  row.innerHTML = `
    <button id="waiter-menu-toggle" class="waiter-btn waiter-btn--main" data-action="toggle-waiter-menu" type="button" aria-expanded="false" aria-controls="waiter-action-menu">Kamarier</button>
    <div id="waiter-action-menu" class="waiter-action-menu" hidden>
      <button class="waiter-btn waiter-btn--option" data-action="call-waiter" data-call-type="help" type="button">Ndihmë</button>
      <button class="waiter-btn waiter-btn--option waiter-btn--payment" data-action="call-waiter" data-call-type="payment" type="button">Pagesë</button>
    </div>
  `;

  const header = document.querySelector('.page-header');
  if (header) header.insertAdjacentElement('afterend', row);
  else document.body.prepend(row);

  renderWaiterButtons();
}
