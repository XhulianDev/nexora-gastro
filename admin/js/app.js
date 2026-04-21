
import { api, supabase } from './api.js';
import { ui } from './ui.js';
import { utils } from './utils.js';

const CURRENT_RESTAURANT_ID = 1;

const state = {
  orders: [],
  menu: [],
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

    ui.elements.removeImageBtn.addEventListener('click', () => {
        ui.elements.currentImageContainer.style.display = 'none';
        ui.elements.saveBtn.dataset.imageRemoved = 'true';
    });

    ui.elements.fImage.addEventListener('change', () => {
        const fileName = ui.elements.fImage.files[0]?.name;
        const nameEl = document.getElementById('file-upload-name');
        if (nameEl) {
            nameEl.textContent = fileName || 'Asnjë skedar i zgjedhur';
        }
    });

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      const { action, itemId, orderId, status } = btn.dataset;

      if (action === 'set-order-status') {
        await api.updateStatus(orderId, status);
        ui.showToast(`Statusi u bë ${status}`);
        return;
      }

      if (action === 'open-add-form') {
        ui.openAddForm();
        return;
      }

      if (action === 'edit-menu-item') {
        const item = state.menu.find(i => i.id == itemId);
        if (item) ui.openEditForm(item);
        return;
      }
      
      if (action === 'delete-menu-item') {
        if (confirm("Fshini artikullin nga menyja?")) {
          const itemToDelete = state.menu.find(i => i.id == itemId);
          if (itemToDelete && itemToDelete.image) {
            await api.deleteMenuImage(itemToDelete.image);
          }
          await api.deleteMenuItem(itemId);
          ui.showToast("U fshi", "error");
        }
        return;
      }
    }

    if (e.target.id === 'form-cancel-btn' || e.target.closest('#form-overlay') && !e.target.closest('.form-modal')) {
      ui.closeForm();
      return;
    }

    if (e.target.id === 'save-btn') {
      const saveButton = e.target;
      saveButton.disabled = true;
      saveButton.textContent = 'Duke ruajtur...';

      const { editId, oldImageUrl, imageRemoved } = saveButton.dataset;
      const imageFile = ui.elements.fImage.files[0];
      let newImageUrl = null;

      try {
        // --- Image Deletion Logic ---
        if (editId && imageRemoved === 'true' && oldImageUrl) {
            await api.deleteMenuImage(oldImageUrl);
        }

        // --- Image Upload Logic ---
        if (imageFile) {
          ui.showToast("Duke optimizuar foton...");
          const optimizedImage = await utils.optimizeImage(imageFile);
          ui.showToast("Duke ngarkuar foton...");
          newImageUrl = await api.uploadMenuImage(optimizedImage);
          
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

        if (newImageUrl) {
            payload.image = newImageUrl;
        } else if (imageRemoved === 'true') {
            payload.image = null;
        } else if (editId) {
            payload.image = oldImageUrl;
        }

        const { error } = await api.saveMenuItem(payload, editId);

        if (!error) {
          ui.showToast(editId ? "U përditësua!" : "U shtua!");
          ui.closeForm();
        } else {
          throw new Error(error.message);
        }

      } catch (error) {
          console.error('Save process failed:', error);
          ui.showToast(`Pati një gabim: ${error.message}`, "error");
          if (newImageUrl) {
              console.warn('Rolling back image upload due to database error...');
              await api.deleteMenuImage(newImageUrl);
          }
      } finally {
          saveButton.disabled = false;
          saveButton.textContent = 'Ruaj';
          delete saveButton.dataset.editId;
          delete saveButton.dataset.oldImageUrl;
          delete saveButton.dataset.imageRemoved;
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', init);