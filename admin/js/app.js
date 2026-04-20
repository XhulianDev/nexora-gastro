
import { api, supabase } from './api.js';
import { ui } from './ui.js';
import { utils } from './utils.js';

const CURRENT_RESTAURANT_ID = 1;

const state = {
  orders: [],
  menu: [],
  activePage: 'orders'
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
          ui.elements.saveBtn.dataset.oldImageUrl = item.image; // Ruaj URL-në e vjetër
          ui.openOverlay(ui.elements.formOverlay);
        }
        return;
      }
      
      if (action === 'delete-menu-item') {
        if (confirm("Fshini artikullin nga menyja?")) {
          const itemToDelete = state.menu.find(i => i.id == itemId);
          if (itemToDelete && itemToDelete.image) {
            await api.deleteMenuImage(itemToDelete.image); // Fshij imazhin e vjetër
          }
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
      const saveButton = e.target;
      saveButton.disabled = true;
      saveButton.textContent = 'Duke ruajtur...';

      const editId = saveButton.dataset.editId;
      const oldImageUrl = saveButton.dataset.oldImageUrl;
      const imageFile = ui.elements.fImage.files[0];
      let newImageUrl = null;

      try {
        if (imageFile) {
          ui.showToast("Duke optimizuar foton...");
          const optimizedImage = await utils.optimizeImage(imageFile);
          ui.showToast("Duke ngarkuar foton...");
          newImageUrl = await api.uploadMenuImage(optimizedImage);

          // Nese ngarkimi i ri pati sukses DHE ishim duke edituar,
          // fshij imazhin e vjeter.
          if (newImageUrl && editId && oldImageUrl) {
              await api.deleteMenuImage(oldImageUrl);
          }
        }

        const payload = {
          name: ui.elements.fName.value,
          price: parseFloat(ui.elements.fPrice.value) || 0,
          description: ui.elements.fDesc.value,
          category: ui.elements.fCat.value,
          restaurant_id: CURRENT_RESTAURANT_ID,
          active: true
        };

        // Shto imazhin ne payload vetem nese eshte i ri ose nese nuk ka nje te ri por jemi duke edituar.
        if (newImageUrl) {
            payload.image = newImageUrl;
        } else if (editId) {
            payload.image = oldImageUrl;
        }

        const { error } = await api.saveMenuItem(payload, editId);

        if (!error) {
          ui.showToast(editId ? "U përditësua!" : "U shtua!");
          ui.closeOverlay(ui.elements.formOverlay);
          ui.elements.fImage.value = '';
        } else {
          throw new Error(error.message);
        }

      } catch (error) {
          console.error('Save process failed:', error);
          ui.showToast(`Pati një gabim: ${error.message}`, "error");
          // Nese ngarkimi i ri deshtoi, mos e fshij imazhin e vjeter!
          // Nese imazhi i ri u ngarkua por ruajtja ne db deshtoi, fshije ate qe sapo u ngarkua.
          if (newImageUrl) {
              console.warn('Rolling back image upload due to database error...');
              await api.deleteMenuImage(newImageUrl);
          }
      } finally {
          saveButton.disabled = false;
          saveButton.textContent = 'Ruaj';
          delete saveButton.dataset.editId;
          delete saveButton.dataset.oldImageUrl;
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
