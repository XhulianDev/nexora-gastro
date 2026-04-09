import { utils } from './utils.js';

/* ─────────────────────────────────────────
   KONSTANTET E UI
───────────────────────────────────────── */
const CATEGORY_LABELS = {
  supat: 'Supa', senduic: 'Sanduiç', burger: 'Burgera', rizoto: 'Rizoto',
  sallata: 'Sallata', pasta: 'Pasta', pica: 'Pica', pule: 'Mish Pule',
  misherat: 'Mishërat', deti: 'Ushqim Deti', desert: 'Ëmbëlsira'
};

const STATUS_LABELS = { new: 'E re', preparing: 'Në përgatitje', done: 'E gatshme' };
const STATUS_CLASSES = { new: 'status-new', preparing: 'status-preparing', done: 'status-done' };

export const ui = {
  /* ─────────────────────────────────────────
      REFERENCAT E DOM
  ───────────────────────────────────────── */
  elements: {
    ordersTime: document.getElementById('orders-time'),
    newBadge: document.getElementById('new-badge'),
    statNew: document.getElementById('stat-new'),
    statRevenue: document.getElementById('stat-revenue'),
    topSellersList: document.getElementById('top-sellers-list'),
    ordersContainer: document.getElementById('orders-container'),
    waiterCallsContainer: document.getElementById('waiter-calls-container'),
    menuRows: document.getElementById('menu-rows'),
    menuSearchInput: document.getElementById('menu-search-input'),
    // Overlays
    dialogOverlay: document.getElementById('dialog-overlay'),
    formOverlay: document.getElementById('form-overlay'),
    callDetailsOverlay: document.getElementById('call-details-overlay'),
    toast: document.getElementById('toast'),
    // Form fields
    fImage: document.getElementById('f-image'),
    fCat: document.getElementById('f-cat'),
    fName: document.getElementById('f-name'),
    fDesc: document.getElementById('f-desc'),
    fPrice: document.getElementById('f-price'),
    formTitle: document.getElementById('form-title'),
    saveBtn: document.getElementById('save-btn')
  },

  /* ─────────────────────────────────────────
      METODAT E RENDERIMIT
  ───────────────────────────────────────── */
  renderOrders: (orders) => {
    const container = ui.elements.ordersContainer;
    if (!container) return;

    const newOrders = orders.filter(o => o.status === 'new');
    const totalRev = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    if (ui.elements.statNew) ui.elements.statNew.textContent = newOrders.length;
    if (ui.elements.statRevenue) ui.elements.statRevenue.textContent = utils.formatMoney(totalRev);
    if (ui.elements.newBadge) {
      ui.elements.newBadge.textContent = newOrders.length;
      ui.elements.newBadge.classList.toggle('visible', newOrders.length > 0);
    }

    if (orders.length === 0) {
      container.innerHTML = `<div class="empty-state">🍽️ Asnjë porosi ende</div>`;
      return;
    }

    container.innerHTML = orders.map(order => `
      <article class="order-card ${order.status}">
        <div class="order-header">
          <div>
            <div class="order-table">Tavolina ${utils.escape(order.table_number)}</div>
            <div class="order-time">${utils.formatTime(order.created_at)}</div>
          </div>
          <span class="order-status ${STATUS_CLASSES[order.status]}">
            ${STATUS_LABELS[order.status]}
          </span>
        </div>
        <div class="order-items">
          ${utils.parseItems(order.items).map(item => `
            <div class="order-line">
              <span><span class="order-line-qty">x${item.qty}</span>${utils.escape(item.name)}</span>
              <span>${utils.formatMoney(Number(item.price) * Number(item.qty))}</span>
            </div>
          `).join('')}
          ${order.note ? `<div class="order-note">📝 ${utils.escape(order.note)}</div>` : ''}
        </div>
        <div class="order-total-row">
          <span>Total</span>
          <span class="order-total-price">${utils.formatMoney(order.total)}</span>
        </div>
        <div class="order-actions">
          ${ui._getOrderActionsHTML(order)}
        </div>
      </article>
    `).join('');
  },

  _getOrderActionsHTML: (order) => {
    if (order.status === 'new') {
      return `<button class="btn btn-primary" data-action="set-order-status" data-order-id="${order.id}" data-status="preparing">Fillo</button>
              <button class="btn btn-red" data-action="delete-order" data-order-id="${order.id}">Fshi</button>`;
    }
    if (order.status === 'preparing') {
      return `<button class="btn btn-green" data-action="set-order-status" data-order-id="${order.id}" data-status="done">✓ Gati</button>
              <button class="btn btn-red" data-action="delete-order" data-order-id="${order.id}">Fshi</button>`;
    }
    return `<button class="btn btn-outline" data-action="delete-order" data-order-id="${order.id}">Fshi historinë</button>`;
  },

  renderMenu: (items, searchTerm = '') => {
    const container = ui.elements.menuRows;
    if (!container) return;

    const filtered = items.filter(i => 
      i.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    container.innerHTML = filtered.map(item => `
      <div class="menu-row">
        <div class="menu-image-cell" style="background-image: url('${utils.escape(item.image || '')}')"></div>
        <div>
          <div class="menu-name">${utils.escape(item.name)}</div>
          <div class="menu-desc">${utils.escape(item.description || '')}</div>
        </div>
        <div><span class="cat-pill">${CATEGORY_LABELS[item.category] || item.category}</span></div>
        <div class="menu-price">${utils.formatMoney(item.price)}</div>
        <div>
          <label class="toggle-switch">
            <input type="checkbox" data-action="toggle-menu-item" data-item-id="${item.id}" ${item.active ? 'checked' : ''} />
            <div class="toggle-track"></div><div class="toggle-thumb"></div>
          </label>
        </div>
        <div class="menu-actions">
          <button class="icon-btn" data-action="edit-menu-item" data-item-id="${item.id}">✎</button>
          <button class="icon-btn danger" data-action="delete-menu-item" data-item-id="${item.id}">✕</button>
        </div>
      </div>
    `).join('');
  },

  renderCalls: (calls) => {
    const container = ui.elements.waiterCallsContainer;
    if (!container) return;
    
    container.style.display = calls.length ? 'grid' : 'none';
    container.innerHTML = calls.map(call => `
      <button class="extended-call-btn" data-action="open-call-details" data-call-id="${call.id}" data-table-number="${call.table_number}">
        <div class="call-btn-main">
          <span class="call-btn-icon">🛎️</span>
          <div class="call-btn-text">
            <span class="call-btn-label">Thirrje Aktive</span>
            <span class="call-btn-table">Tavolina ${call.table_number}</span>
          </div>
        </div>
        <span class="call-btn-arrow">→</span>
      </button>
    `).join('');
  },

  /* ─────────────────────────────────────────
      NDIHMËSIT E FORMAVE DHE OVERLAYS
  ───────────────────────────────────────── */
  openOverlay: (el) => {
    el?.classList.add('open');
    el?.setAttribute('aria-hidden', 'false');
  },

  closeOverlay: (el) => {
    el?.classList.remove('open');
    el?.setAttribute('aria-hidden', 'true');
  },

  showToast: (message, type = 'success') => {
    const t = ui.elements.toast;
    if (!t) return;
    t.textContent = message;
    t.className = `toast ${type} show`;
    setTimeout(() => t.className = 'toast', 2500);
  },

  updateClock: () => {
    if (ui.elements.ordersTime) {
      ui.elements.ordersTime.textContent = new Date().toLocaleTimeString('sq-AL');
    }
  }
};