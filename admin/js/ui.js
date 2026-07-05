import { utils } from './utils.js';

const CATEGORY_LABELS = {
  supat: 'Supa', senduic: 'Sanduiç', burger: 'Burgera', rizoto: 'Rizoto',
  sallata: 'Sallata', pasta: 'Pasta', pica: 'Pica', pule: 'Mish Pule',
  misherat: 'Mishërat', deti: 'Ushqim Deti', desert: 'Ëmbëlsira'
};

const STATUS_LABELS = { new: 'E re', preparing: 'Në përgatitje', done: 'E gatshme' };
const STATUS_CLASSES = { new: 'status-new', preparing: 'status-preparing', done: 'status-done' };

function parseItems(value) {
  return utils.parseItems(value).map((item) => ({
    name: item.name || item.title || 'Artikull',
    qty: Number(item.qty || item.quantity || 1),
    price: Number(item.price || 0),
  }));
}

function getZoneLabel(record) {
  return record?.zone?.label || 'Pa zonë';
}

function getZoneKey(record) {
  return getZoneLabel(record).toLowerCase();
}

function zoneBadge(record) {
  const label = getZoneLabel(record);
  return `<span class="zone-badge">${utils.escape(label)}</span>`;
}

function renderEmpty(container, title, icon = '🍽️') {
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state empty-state--full">
      <div class="empty-icon">${icon}</div>
      <div class="empty-title">${utils.escape(title)}</div>
    </div>
  `;
}

function isToday(value) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

function uniqueById(rows = []) {
  const map = new Map();
  for (const row of rows) {
    if (!row || row.id == null) continue;
    map.set(String(row.id), row);
  }
  return [...map.values()];
}


function callStatusLabel(call) {
  return call?.status === 'acknowledged' ? 'Pranuar' : 'E re';
}

function formatElapsedSince(value, label = 'Pranuar') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return `${label} tani`;
  if (minutes < 60) return `${label} prej ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${label} prej ${hours}h ${rest}min` : `${label} prej ${hours}h`;
}

function orderTimeMeta(order) {
  if (order?.status === 'preparing') return formatElapsedSince(order.updated_at || order.created_at, 'Pranuar');
  if (order?.status === 'done') return formatElapsedSince(order.updated_at || order.created_at, 'Gati');
  return formatElapsedSince(order?.created_at, 'Porositur');
}

function callTimeMeta(call) {
  if (call?.status === 'acknowledged') return formatElapsedSince(call.updated_at || call.created_at, 'Pranuar');
  return formatElapsedSince(call?.created_at, 'Dërguar');
}

function callStatusClass(call) {
  return call?.status === 'acknowledged' ? 'status-preparing' : 'status-new';
}

function callActionHTML(call) {
  if (call?.status === 'acknowledged') {
    return `<button class="btn btn-small btn-red" data-action="delete-waiter-call" data-call-id="${call.id}">Mbyll</button>`;
  }
  return `<button class="btn btn-small btn-yellow" data-action="acknowledge-waiter-call" data-call-id="${call.id}">Prano</button>`;
}

export const ui = {
  elements: {
    ordersTime: document.getElementById('orders-time'),
    newBadge: document.getElementById('new-badge'),
    statNew: document.getElementById('stat-new'),
    statRevenue: document.getElementById('stat-revenue'),
    topSellersList: document.getElementById('top-sellers-list'),
    ordersContainer: document.getElementById('orders-container'),
    waiterCallsContainer: document.getElementById('waiter-calls-container'),
    zoneFiltersContainer: document.getElementById('zone-filters'),
    menuRows: document.getElementById('menu-rows'),
    menuSearchInput: document.getElementById('menu-search-input'),
    formOverlay: document.getElementById('form-overlay'),
    toast: document.getElementById('toast'),
    formTitle: document.getElementById('form-title'),
    fImage: document.getElementById('f-image'),
    fCat: document.getElementById('f-cat'),
    fName: document.getElementById('f-name'),
    fDesc: document.getElementById('f-desc'),
    fPrice: document.getElementById('f-price'),
    saveBtn: document.getElementById('save-btn'),
    currentImageContainer: document.getElementById('current-image-container'),
    currentImagePreview: document.getElementById('current-image-preview'),
    removeImageBtn: document.getElementById('remove-image-btn'),
    selectedImageContainer: document.getElementById('selected-image-container'),
    selectedImagePreview: document.getElementById('selected-image-preview'),
    staffPinStatus: document.getElementById('staff-pin-status'),
    staffDevicesList: document.getElementById('staff-devices-list'),
    archiveOrdersContainer: document.getElementById('archive-orders-container'),
    archiveCallsContainer: document.getElementById('archive-calls-container'),
    archiveOrdersCount: document.getElementById('archive-orders-count'),
    archiveCallsCount: document.getElementById('archive-calls-count'),
    archiveTotalToday: document.getElementById('archive-total-today'),
    archiveOrdersToday: document.getElementById('archive-orders-today'),
    archiveTotalArchived: document.getElementById('archive-total-archived'),
    dialogOverlay: document.getElementById('dialog-overlay'),
    dialogIcon: document.getElementById('dialog-icon'),
    dialogTitle: document.getElementById('dialog-title'),
    dialogSub: document.getElementById('dialog-sub'),
    dialogCancelBtn: document.getElementById('dialog-cancel-btn'),
    dialogConfirmBtn: document.getElementById('dialog-confirm-btn'),
  },

  renderZoneFilters: (zones = [], activeZone = 'all') => {
    const container = ui.elements.zoneFiltersContainer;
    if (!container) return;

    const safeZones = Array.isArray(zones) ? zones : [];
    const buttons = [
      `<button class="zone-filter ${activeZone === 'all' ? 'active' : ''}" type="button" data-zone-filter="all">Të gjitha</button>`,
      ...safeZones.map((zone) => {
        const label = String(zone.label || 'Pa zonë');
        const key = label.toLowerCase();
        return `<button class="zone-filter ${activeZone === key ? 'active' : ''}" type="button" data-zone-filter="${utils.escape(key)}">${utils.escape(label)}</button>`;
      }),
      `<button class="zone-filter ${activeZone === 'pa zonë' ? 'active' : ''}" type="button" data-zone-filter="pa zonë">Pa zonë</button>`,
    ];

    container.innerHTML = buttons.join('');
  },

  renderOrders: (orders = [], activeZone = 'all', archiveOrders = []) => {
    const container = ui.elements.ordersContainer;
    if (!container) return;

    const safeOrders = Array.isArray(orders) ? orders : [];
    const safeArchiveOrders = Array.isArray(archiveOrders) ? archiveOrders : [];
    const allKnownOrders = uniqueById([...safeOrders, ...safeArchiveOrders]);
    const todayOrders = allKnownOrders.filter((order) => isToday(order.created_at));
    const filteredOrders = activeZone === 'all'
      ? safeOrders
      : safeOrders.filter((order) => getZoneKey(order) === activeZone);

    const newOrders = safeOrders.filter((order) => order.status === 'new').length;
    const revenue = todayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);

    if (ui.elements.newBadge) ui.elements.newBadge.textContent = newOrders;
    if (ui.elements.statNew) ui.elements.statNew.textContent = newOrders;
    if (ui.elements.statRevenue) ui.elements.statRevenue.textContent = utils.formatMoney(revenue);
    ui.renderTopSellers(todayOrders);

    if (filteredOrders.length === 0) {
      renderEmpty(container, activeZone === 'all' ? 'Nuk ka porosi aktive' : 'Nuk ka porosi për këtë zonë');
      return;
    }

    container.innerHTML = filteredOrders.map((order) => {
      const items = parseItems(order.items);
      return `
        <article class="order-card ${STATUS_CLASSES[order.status] || ''}">
          <header class="order-card-header staff-card-head">
            <div class="staff-card-left">
              <h3 class="order-title">Porosia #${utils.escape(String(order.id))}</h3>
              <p class="order-meta">Tavolina ${utils.escape(String(order.table_number || '-'))} · ${utils.escape(getZoneLabel(order))}</p>
            </div>
            <div class="staff-card-right">
              <span class="status-pill ${STATUS_CLASSES[order.status] || ''}">${STATUS_LABELS[order.status] || utils.escape(order.status || '—')}</span>
              <strong>${utils.escape(orderTimeMeta(order))}</strong>
            </div>
          </header>

          <div class="order-items">
            ${items.map((item) => `
              <div class="order-item">
                <span>${utils.escape(String(item.qty))}× ${utils.escape(item.name)}</span>
                <strong>${utils.formatMoney(item.qty * item.price)}</strong>
              </div>
            `).join('')}
          </div>

          ${order.note ? `<div class="order-note">${utils.escape(order.note)}</div>` : ''}

          <div class="order-footer">
            <strong>${utils.formatMoney(order.total)}</strong>
            <div class="order-actions">${ui._getOrderActionsHTML(order)}</div>
          </div>
        </article>
      `;
    }).join('');
  },

  _getOrderActionsHTML: (order) => {
    const statusAction = (() => {
      if (order.status === 'new') {
        return `<button class="btn btn-small btn-yellow" data-action="set-order-status" data-order-id="${order.id}" data-status="preparing">Në përgatitje</button>`;
      }
      if (order.status === 'preparing') {
        return `<button class="btn btn-small btn-green" data-action="set-order-status" data-order-id="${order.id}" data-status="done">E gatshme</button>`;
      }
      return '';
    })();

    const archiveAction = order.status === 'done'
      ? `<button class="btn btn-small btn-outline danger" data-action="delete-order" data-order-id="${order.id}">Arkivo</button>`
      : '';

    return `
      ${statusAction}
      ${archiveAction}
    `;
  },

  renderTopSellers: (orders = []) => {
    const counts = new Map();
    for (const order of orders) {
      for (const item of parseItems(order.items)) {
        const key = item.name;
        counts.set(key, (counts.get(key) || 0) + item.qty);
      }
    }

    const top = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (!ui.elements.topSellersList) return;
    ui.elements.topSellersList.innerHTML = top.length
      ? top.map(([name, qty]) => `<div>${utils.escape(name)} <strong>${qty}×</strong></div>`).join('')
      : 'Ende pa shitje';
  },

  renderMenu: (items = [], searchTerm = '') => {
    const container = ui.elements.menuRows;
    if (!container) return;

    const safeItems = Array.isArray(items) ? items : [];
    const term = String(searchTerm || '').toLowerCase().trim();
    const filtered = safeItems.filter((item) =>
      String(item.name || '').toLowerCase().includes(term)
    );

    if (filtered.length === 0) {
      container.innerHTML = `<div class="empty-state">Nuk u gjet asnjë artikull.</div>`;
      return;
    }

    container.innerHTML = filtered.map(item => `
      <div class="menu-row">
        <div class="menu-image-cell" style="background-image: url('${utils.escape(item.image || '')}')"></div>
        <div>
          <div class="menu-name">${utils.escape(item.name || '')}</div>
          <div class="menu-desc">${utils.escape(item.description || '')}</div>
        </div>
        <div><span class="cat-pill">${utils.escape(CATEGORY_LABELS[item.category] || item.category || '-')}</span></div>
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

  renderCalls: (calls = [], activeZone = 'all') => {
    const container = ui.elements.waiterCallsContainer;
    if (!container) return;

    const safeCalls = Array.isArray(calls) ? calls : [];
    const filteredCalls = activeZone === 'all'
      ? safeCalls
      : safeCalls.filter((call) => getZoneKey(call) === activeZone);

    if (filteredCalls.length === 0) {
      container.innerHTML = '';
      return;
    }

    const groups = new Map();
    for (const call of filteredCalls) {
      const table = String(call.table_number || '-');
      if (!groups.has(table)) groups.set(table, []);
      groups.get(table).push(call);
    }

    container.innerHTML = [...groups.entries()].map(([table, group]) => {
      const sorted = [...group].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const lastCall = sorted[0];
      const countLabel = sorted.length === 1 ? '1 thirrje' : `${sorted.length} thirrje`;

      return `
        <article class="call-card call-card--${utils.escape(lastCall.status || 'new')}">
          <header class="call-card-header staff-card-head">
            <div class="staff-card-left">
              <h3>Tavolina ${utils.escape(table)}</h3>
              <p class="call-meta">${utils.escape(getZoneLabel(lastCall))} · ${countLabel}</p>
            </div>
            <div class="staff-card-right">
              <span class="call-status ${callStatusClass(lastCall)}">${callStatusLabel(lastCall)}</span>
              <strong>${utils.escape(callTimeMeta(lastCall))}</strong>
            </div>
          </header>

          <div class="call-card-body">
            ${sorted.map((call) => `
              <div class="call-row call-row--${utils.escape(call.status || 'new')}">
                <div>
                  <strong>${callStatusLabel(call)}</strong>
                  <span>${utils.escape(callTimeMeta(call))}</span>
                </div>
                ${callActionHTML(call)}
              </div>
            `).join('')}
          </div>
        </article>
      `;
    }).join('');
  },

  _resetForm: () => {
    const { formTitle, fName, fPrice, fDesc, fImage, saveBtn, currentImageContainer, currentImagePreview, selectedImageContainer, selectedImagePreview } = ui.elements;
    if (formTitle) formTitle.textContent = 'Shto artikull';
    if (fName) fName.value = '';
    if (fPrice) fPrice.value = '';
    if (fDesc) fDesc.value = '';
    if (fImage) fImage.value = '';
    if (currentImagePreview) currentImagePreview.src = '';
    if (currentImageContainer) currentImageContainer.style.display = 'none';
    if (selectedImagePreview) {
      if (selectedImagePreview.dataset.objectUrl) URL.revokeObjectURL(selectedImagePreview.dataset.objectUrl);
      selectedImagePreview.src = '';
      delete selectedImagePreview.dataset.objectUrl;
    }
    if (selectedImageContainer) selectedImageContainer.style.display = 'none';
    if (saveBtn) {
      delete saveBtn.dataset.editId;
      delete saveBtn.dataset.oldImageUrl;
      delete saveBtn.dataset.imageRemoved;
    }
    const nameEl = document.getElementById('file-upload-name');
    if (nameEl) nameEl.textContent = 'Asnjë skedar i zgjedhur';
  },

  openAddForm: () => {
    ui._resetForm();
    ui.openOverlay(ui.elements.formOverlay);
  },

  openEditForm: (item) => {
    ui._resetForm();
    const { formTitle, fName, fPrice, fDesc, fCat, saveBtn, currentImageContainer, currentImagePreview } = ui.elements;
    if (formTitle) formTitle.textContent = 'Edito artikullin';
    if (fName) fName.value = item.name || '';
    if (fPrice) fPrice.value = item.price || '';
    if (fDesc) fDesc.value = item.description || '';
    if (fCat) fCat.value = item.category || 'supat';

    if (item.image && currentImagePreview && currentImageContainer) {
      currentImagePreview.src = item.image;
      currentImageContainer.style.display = 'block';
      saveBtn.dataset.oldImageUrl = item.image;
    }
    if (saveBtn) saveBtn.dataset.editId = item.id;
    ui.openOverlay(ui.elements.formOverlay);
  },

  closeForm: () => {
    ui.closeOverlay(ui.elements.formOverlay);
    ui._resetForm();
  },

  openOverlay: (el) => {
    if (!el) return;
    el.inert = false;
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
  },

  closeOverlay: (el) => {
    if (!el) return;
    if (document.activeElement && el.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
    el.inert = true;
  },

  showToast: (message, type = 'success') => {
    const existing = ui.elements.toast;
    if (existing) {
      existing.textContent = message;
      existing.className = `toast ${type} show`;
      setTimeout(() => existing.className = 'toast', 3000);
      return;
    }

    const toast = document.createElement('div');
    toast.className = `toast-notification ${type === 'error' ? 'is-error' : ''}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  },

  updateClock: () => {
    if (ui.elements.ordersTime) {
      ui.elements.ordersTime.textContent = new Date().toLocaleTimeString('sq-AL');
    }
  },


  renderArchive: (orders = [], calls = []) => {
    const orderContainer = ui.elements.archiveOrdersContainer;
    const callContainer = ui.elements.archiveCallsContainer;
    const archivedOrders = (Array.isArray(orders) ? orders : []).filter((order) => Boolean(order.deleted_at));
    const archivedCalls = (Array.isArray(calls) ? calls : []).filter((call) => Boolean(call.deleted_at));
    const todayArchivedOrders = archivedOrders.filter((order) => isToday(order.created_at));
    const totalTodayArchived = todayArchivedOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const totalArchived = archivedOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);

    if (ui.elements.archiveOrdersCount) ui.elements.archiveOrdersCount.textContent = String(archivedOrders.length);
    if (ui.elements.archiveCallsCount) ui.elements.archiveCallsCount.textContent = String(archivedCalls.length);
    if (ui.elements.archiveTotalToday) ui.elements.archiveTotalToday.textContent = utils.formatMoney(totalTodayArchived);
    if (ui.elements.archiveOrdersToday) ui.elements.archiveOrdersToday.textContent = String(todayArchivedOrders.length);
    if (ui.elements.archiveTotalArchived) ui.elements.archiveTotalArchived.textContent = utils.formatMoney(totalArchived);

    if (orderContainer) {
      if (archivedOrders.length === 0) {
        orderContainer.innerHTML = '<div class="empty-state">Ende nuk ka porosi të arkivuara.</div>';
      } else {
        orderContainer.innerHTML = archivedOrders.map((order) => {
          const items = parseItems(order.items);
          const archivedText = order.deleted_at ? ` · Arkivuar: ${utils.formatTime(order.deleted_at)}` : '';
          return `
            <article class="archive-row is-archived">
              <div class="archive-row-main">
                <div>
                  <div class="archive-title">#${utils.escape(String(order.id))} · Tavolina ${utils.escape(String(order.table_number || '-'))}</div>
                  <div class="archive-meta">${utils.formatTime(order.created_at)}${archivedText} · ${zoneBadge(order)} · ${items.length} artikuj</div>
                </div>
                <div class="archive-row-side">
                  <span class="status-pill ${STATUS_CLASSES[order.status] || ''}">${STATUS_LABELS[order.status] || utils.escape(order.status || '—')}</span>
                  <strong>${utils.formatMoney(order.total)}</strong>
                  <span class="archive-state is-archived">Arkivuar</span>
                </div>
              </div>
              <div class="archive-items">
                ${items.slice(0, 4).map((item) => `${utils.escape(String(item.qty))}× ${utils.escape(item.name)}`).join(' · ')}${items.length > 4 ? ' · ...' : ''}
              </div>
            </article>
          `;
        }).join('');
      }
    }

    if (callContainer) {
      if (archivedCalls.length === 0) {
        callContainer.innerHTML = '<div class="empty-state">Ende nuk ka thirrje të mbyllura.</div>';
      } else {
        callContainer.innerHTML = archivedCalls.map((call) => {
          const archivedText = call.deleted_at ? ` · Mbyllur: ${utils.formatTime(call.deleted_at)}` : '';
          return `
            <article class="archive-row is-archived">
              <div class="archive-row-main">
                <div>
                  <div class="archive-title">🔔 Tavolina ${utils.escape(String(call.table_number || '-'))}</div>
                  <div class="archive-meta">${utils.formatTime(call.created_at)}${archivedText} · ${zoneBadge(call)}</div>
                </div>
                <div class="archive-row-side">
                  <span class="archive-state is-archived">Mbyllur</span>
                </div>
              </div>
            </article>
          `;
        }).join('');
      }
    }
  },

  confirm: ({ title = 'A jeni i sigurt?', message = 'Ky veprim nuk mund të kthehet mbrapsht.', confirmText = 'Konfirmo', icon = '⚠️', danger = true } = {}) => {
    const { dialogOverlay, dialogIcon, dialogTitle, dialogSub, dialogCancelBtn, dialogConfirmBtn } = ui.elements;
    if (!dialogOverlay || !dialogCancelBtn || !dialogConfirmBtn) return Promise.resolve(window.confirm(message));

    return new Promise((resolve) => {
      if (dialogIcon) dialogIcon.textContent = icon;
      if (dialogTitle) dialogTitle.textContent = title;
      if (dialogSub) dialogSub.textContent = message;
      dialogConfirmBtn.textContent = confirmText;
      dialogConfirmBtn.className = danger ? 'btn btn-red' : 'btn btn-primary';

      const cleanup = (result) => {
        dialogCancelBtn.removeEventListener('click', onCancel);
        dialogConfirmBtn.removeEventListener('click', onConfirm);
        dialogOverlay.removeEventListener('click', onOverlay);
        document.removeEventListener('keydown', onKeydown);
        ui.closeOverlay(dialogOverlay);
        resolve(result);
      };
      const onCancel = () => cleanup(false);
      const onConfirm = () => cleanup(true);
      const onOverlay = (event) => { if (event.target === dialogOverlay) cleanup(false); };
      const onKeydown = (event) => { if (event.key === 'Escape') cleanup(false); };

      dialogCancelBtn.addEventListener('click', onCancel);
      dialogConfirmBtn.addEventListener('click', onConfirm);
      dialogOverlay.addEventListener('click', onOverlay);
      document.addEventListener('keydown', onKeydown);
      ui.openOverlay(dialogOverlay);
      setTimeout(() => dialogCancelBtn.focus(), 0);
    });
  },

  renderStaffSettings: (settings = {}) => {
    if (!ui.elements.staffPinStatus) return;
    ui.elements.staffPinStatus.textContent = settings.configured ? 'PIN aktiv' : 'PIN mungon';
    ui.elements.staffPinStatus.className = 'settings-status ' + (settings.configured ? 'is-ok' : 'is-warning');

    const sessionInput = document.getElementById('staff-session-hours');
    const sessionMinutesInput = document.getElementById('staff-session-minutes');
    const expiryInput = document.getElementById('staff-device-expiry-days');
    const fields = [sessionInput, sessionMinutesInput, expiryInput].filter(Boolean);

    // Polling/live refresh must not overwrite admin input fields while the admin is working.
    // Populate them once after page load; after that, the current typed values are respected.
    const alreadyInitialized = fields.some((field) => field.dataset.initialized === 'true');
    const activeElement = document.activeElement;
    const userIsEditing = fields.includes(activeElement) || fields.some((field) => field.dataset.dirty === 'true');
    if (alreadyInitialized || userIsEditing) return;

    if (sessionInput) {
      sessionInput.value = Number.isFinite(Number(settings.sessionHours)) ? settings.sessionHours : 16;
      sessionInput.dataset.initialized = 'true';
    }
    if (sessionMinutesInput) {
      sessionMinutesInput.value = Number.isFinite(Number(settings.sessionMinutes)) ? settings.sessionMinutes : 0;
      sessionMinutesInput.dataset.initialized = 'true';
    }
    if (expiryInput) {
      expiryInput.value = settings.deviceExpiryDays || 30;
      expiryInput.dataset.initialized = 'true';
    }
  },

  renderStaffDevices: (devices = []) => {
    const container = ui.elements.staffDevicesList;
    if (!container) return;
    const safeDevices = Array.isArray(devices) ? devices : [];
    if (safeDevices.length === 0) {
      container.innerHTML = '<div class="empty-state">Nuk ka pajisje të regjistruara.</div>';
      return;
    }
    container.innerHTML = safeDevices.map((device) => {
      const status = String(device.status || 'pending');
      const canApprove = status === 'pending';
      const statusLabels = { pending: 'Në pritje', approved: 'Aprovuar', revoked: 'Revokuar' };
      const removeLabel = status === 'approved' ? 'Hiq qasjen' : 'Fshi';
      return `
        <article class="device-card device-card--${utils.escape(status)}">
          <div>
            <div class="device-title">${utils.escape(device.label || 'Pajisje stafi')}</div>
            <div class="device-meta">${utils.escape(device.device_type || 'unknown')} · ${utils.escape(device.browser_name || 'Browser')} · ${utils.escape(device.os_name || 'Unknown OS')}</div>
            <div class="device-meta">ID: ${utils.escape(String(device.device_id || '').slice(0, 18))}...</div>
            <div class="device-meta">Statusi: ${utils.escape(statusLabels[status] || status)} · Aktiviteti i fundit: ${device.last_seen_at ? utils.formatTime(device.last_seen_at) : '-'}</div>
            <div class="device-meta">Skadon: ${device.expires_at ? new Date(device.expires_at).toLocaleDateString('sq-AL') : '-'}</div>
          </div>
          <div class="device-actions">
            ${canApprove ? `<button class="btn btn-small" data-action="approve-staff-device" data-device-id="${device.id}">Aprovo</button>` : ''}
            <button class="btn btn-small btn-outline danger" data-action="delete-staff-device" data-device-id="${device.id}">${removeLabel}</button>
          </div>
        </article>
      `;
    }).join('');
  }
};
