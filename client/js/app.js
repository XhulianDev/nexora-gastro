import { API } from './constants.js';
import { getActiveOrderIdsFromStorage, setActiveOrderIdsToStorage } from './utils.js';
import { state, findMenuItemById } from './state.js';
import { fetchActiveMenu, submitOrder, fetchActiveOrders, insertWaiterCall } from './api.js';
import * as ui from './ui.js';

// Nisja e aplikacionit
document.addEventListener('DOMContentLoaded', bootstrap);

async function bootstrap() {
  ui.setTableLabel();
  injectWaiterButton();
  bindStaticEvents();

  // Ngarkimi fillestar i menusë
  await initMenu();
  
  // Sinkronizimi i parë i statuseve
  await syncStatus();

  // Refresh automatik për statuset e porosisë
  window.setInterval(syncStatus, API.REFRESH_INTERVAL);
}

function bindStaticEvents() {
  // Përdorim Event Delegation për performancë maksimale
  document.addEventListener('click', handleGlobalClicks);
  
  const overlay = document.querySelector('#overlay');
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) ui.closeModal();
  });
}

function handleGlobalClicks(event) {
  const target = event.target;

  // 1. Ndryshimi i kategorisë nga menyja kryesore
  const catBtn = target.closest('[data-category]:not([data-action="view-category"])');
  if (catBtn) {
    state.activeCategory = catBtn.dataset.category;
    ui.renderCategories();
    ui.renderMenu();
    return;
  }

  // 2. Navigimi direkt te kategoria (nga Upsell ose butona të tjerë specialë)
  const viewCatBtn = target.closest('[data-action="view-category"]');
  if (viewCatBtn) {
    const category = viewCatBtn.dataset.category;
    ui.navigateToCategory(category);
    return;
  }

  // 3. Ndryshimi i sasisë (+/-)
  const qtyBtn = target.closest('[data-action="change-qty"]');
  if (qtyBtn) {
    const itemId = qtyBtn.dataset.itemId;
    const delta = parseInt(qtyBtn.dataset.delta, 10);
    changeQty(itemId, delta);
    return;
  }

  // 4. Shtimi nga Upsell
  const upsellBtn = target.closest('[data-action="upsell-add"]');
  if (upsellBtn) {
    changeQty(upsellBtn.dataset.itemId, 1);
    return;
  }

  // 5. Hapja e modalit (Checkout)
  if (target.closest('#cart-open-btn')) {
    ui.openModal();
    return;
  }

  // 6. Dërgimi i porosisë
  if (target.closest('[data-action="send-order"]')) {
    sendOrder();
    return;
  }

  // 7. Hub-i i statuseve
  if (target.closest('[data-action="toggle-hub"]')) {
    event.stopPropagation();
    ui.toggleHubDropdown();
    return;
  }

  if (target.closest('[data-action="view-all-status"]')) {
    window.location.href = 'status/?all=true';
    return;
  }

  // Mbyllja e dropdown-it nëse klikohet jashtë
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
  }
}

function changeQty(itemId, delta) {
  const currentQty = state.cart[itemId] || 0;
  const nextQty = currentQty + delta;

  if (nextQty <= 0) {
    delete state.cart[itemId];
  } else {
    state.cart[itemId] = nextQty;
  }

  ui.updateCartBar();
  ui.renderMenu();

  const isModalOpen = document.querySelector('#overlay')?.classList.contains('is-visible');
  if (isModalOpen) {
    if (Object.keys(state.cart).length === 0) {
      ui.closeModal();
    } else {
      ui.renderModalContent();
    }
  }
}

async function sendOrder() {
  const sendBtn = document.querySelector('#send-btn');
  const noteField = document.querySelector('#note');
  if (!sendBtn || sendBtn.disabled) return;

  sendBtn.disabled = true;
  sendBtn.textContent = 'Duke dërguar...';

  try {
    const items = Object.entries(state.cart).map(([id, qty]) => {
      const item = findMenuItemById(id);
      return item ? { id: item.id, name: item.name, qty, price: parseFloat(item.price) } : null;
    }).filter(Boolean);

    const total = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const note = noteField?.value?.trim() || '';

    const data = await submitOrder(state.tableNumber, items, total, note);

    const activeIds = getActiveOrderIdsFromStorage();
    activeIds.push(data.id);
    setActiveOrderIdsToStorage(activeIds);

    state.cart = {};
    window.location.href = `status/?id=${data.id}`;
  } catch (error) {
    console.error('Dështoi dërgimi:', error);
    alert('Gabim gjatë dërgimit të porosisë.');
    sendBtn.disabled = false;
    sendBtn.textContent = 'DËRGO POROSINË';
  }
}

async function syncStatus() {
  const activeIds = getActiveOrderIdsFromStorage();
  if (!activeIds.length) {
    ui.renderStatusHub([]);
    return;
  }

  try {
    const data = await fetchActiveOrders(activeIds);
    const wasOpen = document.querySelector('#hub-drop')?.classList.contains('is-open');
    ui.renderStatusHub(data || [], wasOpen);
  } catch (error) {
    console.error('Gabim në sinkronizim:', error);
  }
}

async function callWaiter() {
  const btn = document.querySelector('#waiter-btn');
  if (!btn || btn.disabled) return;

  btn.innerHTML = '⏳ Po vjen...';
  btn.disabled = true;

  try {
    await insertWaiterCall(state.tableNumber);
    setTimeout(() => {
      btn.innerHTML = '🔔 Kamarieri';
      btn.disabled = false;
    }, API.WAITER_COOLDOWN);
  } catch (error) {
    console.error('Gabim kamarieri:', error);
    btn.innerHTML = '🔔 Kamarieri';
    btn.disabled = false;
  }
}

function injectWaiterButton() {
  if (document.querySelector('#waiter-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'waiter-btn';
  btn.className = 'waiter-btn';
  btn.innerHTML = '🔔 Kamarieri';
  btn.onclick = callWaiter;
  document.body.appendChild(btn);
}