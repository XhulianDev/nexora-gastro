import { api, supabase } from './api.js';
import { ui } from './ui.js';

const CURRENT_RESTAURANT_ID = 1;

const state = {
  orders: [],
  menu: [],
  activePage: 'orders'
};

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
    item.addEventListener('click', (e) => {
      const targetPage = e.currentTarget.dataset.page;
      if (!targetPage) return;
      
      navItems.forEach(nav => nav.classList.remove('active'));
      e.currentTarget.classList.add('active');
      
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
    document.getElementById('view-live-site-btn').addEventListener('click', () => {
        window.location.href = '/';
    });

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      const { action, itemId, callId, tableNumber, orderId, status } = btn.dataset;

      if (action === 'set-order-status') {
        await api.updateStatus(orderId, status);
        ui.showToast(`Statusi u bë ${status}`);
        return;
      }

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
          ui.elements.fImage.value = ''; 
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

      if (action === 'open-call-details') {
        document.getElementById('call-table-num').textContent = tableNumber;
        document.getElementById('resolve-call-btn').dataset.callId = callId;
        // Logjikë tjetër...
        return;
      }
    }

    if (e.target.id === 'form-cancel-btn' || e.target.closest('#form-overlay') && !e.target.closest('.form-modal')) {
      ui.closeOverlay(ui.elements.formOverlay);
      return;
    }

    if (e.target.id === 'save-btn') {
      e.target.disabled = true;
      e.target.textContent = 'Duke ruajtur...';

      const editId = e.target.dataset.editId;
      const imageFile = ui.elements.fImage.files[0];
      let imageUrl = null;

      if (imageFile) {
        ui.showToast("Duke ngarkuar foton...");
        imageUrl = await api.uploadMenuImage(imageFile);
        if (!imageUrl) {
          ui.showToast("Fotoja nuk u ngarkua dot.", "error");
          e.target.disabled = false;
          e.target.textContent = 'Ruaj';
          return;
        }
      } else if (editId) {
        const existingItem = state.menu.find(i => i.id == editId);
        imageUrl = existingItem ? existingItem.image : null;
      }

      const payload = {
        name: ui.elements.fName.value,
        price: parseFloat(ui.elements.fPrice.value) || 0,
        description: ui.elements.fDesc.value,
        category: ui.elements.fCat.value,
        image: imageUrl,
        restaurant_id: CURRENT_RESTAURANT_ID,
        active: true
      };

      const { error } = await api.saveMenuItem(payload, editId);

      if (!error) {
        ui.showToast(editId ? "U përditësua!" : "U shtua!");
        ui.closeOverlay(ui.elements.formOverlay);
        ui.elements.fImage.value = '';
      } else {
        ui.showToast("Pati një gabim gjatë ruajtjes.", "error");
      }
      
      e.target.disabled = false;
      e.target.textContent = 'Ruaj';
    }
  });
}

document.addEventListener('DOMContentLoaded', init);