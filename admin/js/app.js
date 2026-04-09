import { api, supabase } from './api.js';
import { ui } from './ui.js';

const CURRENT_RESTAURANT_ID = 1; 

const state = {
  orders: [],
  menu: [],
  activePage: 'orders'
};

// Funksione ndihmëse për përpunimin e të dhënave
const utils = {
  parseItems: (itemsRaw) => {
    try {
      return typeof itemsRaw === 'string' ? JSON.parse(itemsRaw) : itemsRaw;
    } catch (e) {
      return [];
    }
  },
  formatTime: (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('sq-AL', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
};

async function init() {
  ui.updateClock();
  setInterval(ui.updateClock, 1000);
  
  setupNavigation();
  setupEventListeners();
  
  await refreshData();
  listenRealtime();
}

async function refreshData() {
  const [ordersRes, menuRes, callsRes] = await Promise.all([
    api.getOrders(CURRENT_RESTAURANT_ID),
    api.getMenu(CURRENT_RESTAURANT_ID),
    api.getCalls(CURRENT_RESTAURANT_ID)
  ]);

  state.orders = ordersRes.data || [];
  state.menu = menuRes.data || [];

  ui.renderOrders(state.orders);
  ui.renderMenu(state.menu);
  ui.renderCalls(callsRes.data || []);
}

function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetPage = item.dataset.page;
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      pages.forEach(page => {
        page.style.display = (page.id === `page-${targetPage}`) ? 'block' : 'none';
      });
    });
  });
  document.getElementById('nav-orders').click();
}

function listenRealtime() {
  supabase.channel('admin-dashboard')
    .on('postgres_changes', { event: '*', schema: 'public' }, () => refreshData())
    .subscribe();
}

function setupEventListeners() {
  document.addEventListener('click', async (e) => {
    // A. Veprimet me data-action
    const btn = e.target.closest('[data-action]');
    if (btn) {
      const { action, orderId, status, itemId, callId, tableNumber } = btn.dataset;

      // Porositë
      if (action === 'set-order-status') {
        const { error } = await api.updateStatus(orderId, status);
        if (!error) ui.showToast(`Statusi u bë ${status}`);
        return;
      }

      if (action === 'delete-order') {
        if (confirm("Fshini porosinë?")) {
          await api.deleteOrder(orderId);
          ui.showToast("U fshi", "error");
        }
        return;
      }

      // Menyja
      if (action === 'open-add-form') {
        ui.elements.formTitle.textContent = "Shto artikull";
        ui.elements.fName.value = ui.elements.fPrice.value = ui.elements.fDesc.value = ui.elements.fImage.value = '';
        delete ui.elements.saveBtn.dataset.editId;
        ui.openOverlay(ui.elements.formOverlay);
        return;
      }

      if (action === 'edit-menu-item') {
        const item = state.menu.find(i => i.id == itemId);
        if (item) {
          ui.elements.formTitle.textContent = "Edito artikullin";
          ui.elements.fName.value = item.name;
          ui.elements.fPrice.value = item.price;
          ui.elements.fDesc.value = item.description;
          ui.elements.fCat.value = item.category;
          ui.elements.fImage.value = item.image || '';
          ui.elements.saveBtn.dataset.editId = item.id;
          ui.openOverlay(ui.elements.formOverlay);
        }
        return;
      }

      if (action === 'delete-menu-item') {
        if (confirm("Fshini artikullin nga menyja?")) {
          await api.deleteMenuItem(itemId);
          ui.showToast("U fshi", "error");
        }
        return;
      }

      // Thirrjet (Hapja e detajeve)
      if (action === 'open-call-details') {
        document.getElementById('call-table-num').textContent = tableNumber;
        document.getElementById('resolve-call-btn').dataset.callId = callId;

        const container = document.getElementById('call-order-items');
        const activeOrders = state.orders.filter(o => 
          String(o.table_number) === String(tableNumber) && o.status !== 'done'
        );

        if (container) {
          if (activeOrders.length > 0) {
            container.innerHTML = activeOrders.map(order => `
              <div class="call-order-group">
                <span class="call-order-time">Porosia e orës ${utils.formatTime(order.created_at)}</span>
                ${utils.parseItems(order.items).map(item => `
                  <div class="call-order-item">
                    <span>${item.qty}x ${item.name}</span>
                  </div>
                `).join('')}
              </div>
            `).join('');
          } else {
            container.innerHTML = `<div class="call-order-list-empty">Nuk ka porosi aktive për këtë tavolinë.</div>`;
          }
        }
        ui.openOverlay(ui.elements.callDetailsOverlay);
        return;
      }
    }

    // B. Veprimet me ID specifike (Butonat e dritareve)
    if (e.target.id === 'resolve-call-btn') {
      const { error } = await api.deleteCall(e.target.dataset.callId);
      if (!error) {
        ui.showToast("Thirrja u mbyll");
        ui.closeOverlay(ui.elements.callDetailsOverlay);
      }
      return;
    }

    if (e.target.id === 'form-cancel-btn' || e.target.id === 'call-details-cancel-btn') {
      ui.closeOverlay(ui.elements.formOverlay);
      ui.closeOverlay(ui.elements.callDetailsOverlay);
      return;
    }

    if (e.target.id === 'save-btn') {
      const editId = e.target.dataset.editId;
      const payload = {
        name: ui.elements.fName.value,
        price: parseFloat(ui.elements.fPrice.value) || 0,
        description: ui.elements.fDesc.value,
        category: ui.elements.fCat.value,
        image: ui.elements.fImage.value,
        restaurant_id: CURRENT_RESTAURANT_ID,
        active: true
      };

      const { error } = await api.saveMenuItem(payload, editId);
      if (!error) {
        ui.showToast(editId ? "U përditësua!" : "U shtua!");
        ui.closeOverlay(ui.elements.formOverlay);
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', init);