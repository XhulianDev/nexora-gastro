
import { utils } from './utils.js';

const CATEGORY_LABELS = {
  supat: 'Supa', senduic: 'Sanduiç', burger: 'Burgera', rizoto: 'Rizoto',
  sallata: 'Sallata', pasta: 'Pasta', pica: 'Pica', pule: 'Mish Pule',
  misherat: 'Mishërat', deti: 'Ushqim Deti', desert: 'Ëmbëlsira'
};

const STATUS_LABELS = { new: 'E re', preparing: 'Në përgatitje', done: 'E gatshme' };
const STATUS_CLASSES = { new: 'status-new', preparing: 'status-preparing', done: 'status-done' };

export const ui = {
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
    formOverlay: document.getElementById('form-overlay'),
    toast: document.getElementById('toast'),
    // Form fields
    formTitle: document.getElementById('form-title'),
    fImage: document.getElementById('f-image'),
    fCat: document.getElementById('f-cat'),
    fName: document.getElementById('f-name'),
    fDesc: document.getElementById('f-desc'),
    fPrice: document.getElementById('f-price'),
    saveBtn: document.getElementById('save-btn'),
    // Image preview elements
    currentImageContainer: document.getElementById('current-image-container'),
    currentImagePreview: document.getElementById('current-image-preview'),
    removeImageBtn: document.getElementById('remove-image-btn'),
  },

  renderOrders: (orders) => {
    // ... (render logic remains the same)
  },

  _getOrderActionsHTML: (order) => {
    // ... (render logic remains the same)
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
      // ... (render logic remains the same)
  },

  _resetForm: () => {
    const { formTitle, fName, fPrice, fDesc, fImage, saveBtn, currentImageContainer, currentImagePreview } = ui.elements;
    formTitle.textContent = "Shto artikull";
    fName.value = fPrice.value = fDesc.value = fImage.value = '';
    currentImagePreview.src = '';
    currentImageContainer.style.display = 'none';
    delete saveBtn.dataset.editId;
    delete saveBtn.dataset.oldImageUrl;
    delete saveBtn.dataset.imageRemoved;
  },

  openAddForm: () => {
    ui._resetForm();
    ui.openOverlay(ui.elements.formOverlay);
  },

  openEditForm: (item) => {
    ui._resetForm();
    const { formTitle, fName, fPrice, fDesc, fCat, saveBtn, currentImageContainer, currentImagePreview } = ui.elements;
    formTitle.textContent = "Edito artikullin";
    fName.value = item.name;
    fPrice.value = item.price;
    fDesc.value = item.description;
    fCat.value = item.category;
    
    if (item.image) {
      currentImagePreview.src = item.image;
      currentImageContainer.style.display = 'block';
      saveBtn.dataset.oldImageUrl = item.image;
    }
    saveBtn.dataset.editId = item.id;
    ui.openOverlay(ui.elements.formOverlay);
  },

  closeForm: () => {
    ui.closeOverlay(ui.elements.formOverlay);
    ui._resetForm();
  },

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