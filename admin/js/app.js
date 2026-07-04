import { api, supabase } from './api.js';
import { ui } from './ui.js';
import { utils } from './utils.js';

const state = {
  orders: [],
  menu: [],
  calls: [],
  zones: [],
  activeZone: 'all',
  realtimeChannel: null,
  staffSettings: null,
  staffDevices: [],
  archiveOrders: [],
  archiveCalls: [],
  refreshInFlight: null,
  fallbackPollingId: null,
  lastCounts: null,
  notifyTimers: {},
};

const authElements = {
  screen: document.getElementById('admin-auth-screen'),
  layout: document.getElementById('admin-layout'),
  loginForm: document.getElementById('admin-login-form'),
  email: document.getElementById('admin-email'),
  password: document.getElementById('admin-password'),
  error: document.getElementById('auth-error'),
  logout: document.getElementById('admin-logout-btn'),
};

function showAuthError(message) {
  if (!authElements.error) return;
  authElements.error.textContent = message || '';
  authElements.error.classList.toggle('visible', Boolean(message));
}

function showApp() {
  authElements.screen?.setAttribute('hidden', 'true');
  authElements.layout?.removeAttribute('hidden');
}

function showLogin() {
  authElements.layout?.setAttribute('hidden', 'true');
  authElements.screen?.removeAttribute('hidden');
}

async function init() {
  setupAuthEvents();

  const hasSession = await api.hasAuthSession();
  if (!hasSession) {
    showLogin();
    return;
  }

  await bootAdmin();
}

async function bootAdmin() {
  showAuthError('');
  showApp();
  ui.updateClock();
  window.setInterval(ui.updateClock, 1000);
  setupNavigation();
  setupEventListeners();

  try {
    await refreshData();
    listenRealtime();
    startFallbackPolling();
  } catch (error) {
    console.error('[Admin init failed]', error);
    ui.showToast(error.message || 'Admin paneli nuk u ngarkua.', 'error');
    showLogin();
  }
}

function setupAuthEvents() {
  authElements.loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    showAuthError('');

    try {
      const email = authElements.email?.value.trim();
      const password = authElements.password?.value || '';
      if (!email || !password) throw new Error('Email dhe fjalëkalimi janë të detyrueshme.');
      await api.signIn(email, password);
      await bootAdmin();
    } catch (error) {
      showAuthError(error.message || 'Hyrja dështoi.');
    }
  });

  authElements.logout?.addEventListener('click', async () => {
    await api.signOut();
    if (state.realtimeChannel) await supabase.removeChannel(state.realtimeChannel);
    state.realtimeChannel = null;
    if (state.fallbackPollingId) window.clearInterval(state.fallbackPollingId);
    state.fallbackPollingId = null;
    showLogin();
  });
}

async function refreshData() {
  if (state.refreshInFlight) return state.refreshInFlight;

  state.refreshInFlight = (async () => {
    const beforeCounts = state.lastCounts;
    const [ordersRes, menuRes, callsRes, zonesRes, settingsRes, devicesRes, archiveRes] = await Promise.all([
      api.getOrders(),
      api.getMenu(),
      api.getCalls(),
      api.getZones(),
      api.getStaffSettings().catch(() => ({ data: null })),
      api.getStaffDevices().catch(() => ({ data: [] })),
      api.getArchive().catch(() => ({ data: { orders: [], calls: [] } })),
    ]);

    state.orders = ordersRes.data || [];
    state.menu = menuRes.data || [];
    state.calls = callsRes.data || [];
    state.zones = zonesRes.data || [];
    state.staffSettings = settingsRes.data || null;
    state.staffDevices = devicesRes.data || [];
    state.archiveOrders = archiveRes.data?.orders || [];
    state.archiveCalls = archiveRes.data?.calls || [];

    renderDashboard();
    const afterCounts = getCurrentCounts();
    notifySidebarChanges(beforeCounts, afterCounts);
    state.lastCounts = afterCounts;
  })().finally(() => {
    state.refreshInFlight = null;
  });

  return state.refreshInFlight;
}

function renderDashboard() {
  ui.renderZoneFilters(state.zones, state.activeZone);
  ui.renderOrders(state.orders, state.activeZone, state.archiveOrders);
  ui.renderMenu(state.menu, ui.elements.menuSearchInput?.value || '');
  ui.renderCalls(state.calls, state.activeZone);
  ui.renderStaffSettings(state.staffSettings || {});
  ui.renderStaffDevices(state.staffDevices || []);
  ui.renderArchive(state.archiveOrders || [], state.archiveCalls || []);
}


function getActivePage() {
  return location.hash.replace('#', '') || 'orders';
}

function getCurrentCounts() {
  return {
    orders: state.orders.length,
    calls: state.calls.length,
    archive: state.archiveOrders.length + state.archiveCalls.length,
    menu: state.menu.length,
    devices: state.staffDevices.filter((device) => device.status === 'pending').length,
  };
}

function orderArchiveConfirmMessage(count) {
  return count === 1
    ? 'Do të arkivohet 1 porosi e kryer. Porositë e tjera nuk preken.'
    : `Do të arkivohen ${count} porosi të kryera. Porositë e tjera nuk preken.`;
}

function callCloseConfirmMessage(count) {
  return count === 1
    ? 'Do të mbyllet 1 thirrje aktive dhe do të ruhet në Arkiv.'
    : `Do të mbyllen ${count} thirrje aktive dhe do të ruhen në Arkiv.`;
}

function archivedOrdersToast(count) {
  return count === 1 ? '1 porosi u arkivua.' : `${count} porosi u arkivuan.`;
}

function closedCallsToast(count) {
  return count === 1 ? '1 thirrje u mbyll.' : `${count} thirrje u mbyllën.`;
}

function flashNav(page) {
  const item = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (!item || item.classList.contains('active')) return;
  item.classList.add('has-update');
  if (state.notifyTimers[page]) window.clearTimeout(state.notifyTimers[page]);
  state.notifyTimers[page] = window.setTimeout(() => item.classList.remove('has-update'), 5000);
}

function notifySidebarChanges(before, after) {
  if (!before) return;
  const active = getActivePage();
  if ((before.orders !== after.orders || before.calls !== after.calls) && active !== 'orders') flashNav('orders');
  if (before.archive !== after.archive && active !== 'archive') flashNav('archive');
  if (before.menu !== after.menu && active !== 'menu') flashNav('menu');
  if (before.devices !== after.devices && active !== 'staff-settings') flashNav('staff-settings');
}

function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item[data-page]');
  const pages = document.querySelectorAll('.page');

  const showPage = (targetPage = 'orders', updateHash = true) => {
    const target = document.querySelector(`.nav-item[data-page="${targetPage}"]`) ? targetPage : 'orders';
    navItems.forEach(nav => nav.classList.toggle('active', nav.dataset.page === target));
    pages.forEach(page => {
      page.classList.toggle('active', page.id === `page-${target}`);
    });
    if (updateHash) {
      history.replaceState(null, '', `#${target}`);
    }
  };

  navItems.forEach(item => {
    item.addEventListener('click', (event) => {
      const targetPage = event.currentTarget.dataset.page;
      if (!targetPage) return;
      event.currentTarget.classList.remove('has-update');
      showPage(targetPage, true);
    });
  });

  window.addEventListener('hashchange', () => showPage(location.hash.replace('#', '') || 'orders', false));
  showPage(location.hash.replace('#', '') || 'orders', false);
}

function listenRealtime() {
  if (state.realtimeChannel) return;

  state.realtimeChannel = supabase.channel('admin-dashboard')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refreshData)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_calls' }, refreshData)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'menu' }, refreshData)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'table_zones' }, refreshData)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_devices' }, refreshData)
    .subscribe();
}

function startFallbackPolling() {
  if (state.fallbackPollingId) return;
  state.fallbackPollingId = window.setInterval(() => {
    if (authElements.layout?.hasAttribute('hidden')) return;
    refreshData().catch((error) => console.warn('[Admin polling failed]', error));
  }, 5000);
}

function setupEventListeners() {
  document.getElementById('view-live-site-btn')?.addEventListener('click', () => {
    window.open('/client/?table=1', '_blank', 'noopener');
  });

  ui.elements.menuSearchInput?.addEventListener('input', (event) => {
    ui.renderMenu(state.menu, event.target.value);
  });

  const staffSettingsFields = [
    document.getElementById('staff-pin-input'),
    document.getElementById('staff-session-hours'),
    document.getElementById('staff-session-minutes'),
    document.getElementById('staff-device-expiry-days'),
  ].filter(Boolean);

  const markStaffSettingsClean = () => {
    staffSettingsFields.forEach((field) => { field.dataset.dirty = 'false'; });
  };

  staffSettingsFields.forEach((field) => {
    field.addEventListener('input', () => { field.dataset.dirty = 'true'; });
  });

  document.getElementById('save-staff-pin-btn')?.addEventListener('click', async () => {
    const pinInput = document.getElementById('staff-pin-input');
    const pin = pinInput?.value.trim() || '';
    const sessionHours = Number(document.getElementById('staff-session-hours')?.value || 0);
    const sessionMinutes = Number(document.getElementById('staff-session-minutes')?.value || 0);
    const deviceExpiryDays = Number(document.getElementById('staff-device-expiry-days')?.value || 30);

    await runAction(async () => {
      await api.updateStaffPin({ pin, sessionHours, sessionMinutes, deviceExpiryDays });
      if (pinInput) pinInput.value = '';
      markStaffSettingsClean();
      ui.showToast(pin ? 'PIN-i i stafit dhe qasja u ruajtën.' : 'Qasja u ruajt.');
      await refreshData();
    }, 'Cilësimet nuk u ruajtën.');
  });

  document.getElementById('refresh-devices-btn')?.addEventListener('click', async () => {
    await runAction(refreshData, 'Pajisjet nuk u rifreskuan.');
  });

  document.getElementById('refresh-archive-btn')?.addEventListener('click', async () => {
    await runAction(refreshData, 'Arkivi nuk u rifreskua.');
  });

  document.getElementById('admin-bulk-archive-done-btn')?.addEventListener('click', async () => {
    const ids = state.orders.filter((order) => order.status === 'done').map((order) => order.id);
    if (!ids.length) {
      ui.showToast('Nuk ka porosi të gatshme për arkivim.');
      return;
    }
    const confirmed = await ui.confirm({
      title: 'Arkivo porositë e gatshme?',
      message: orderArchiveConfirmMessage(ids.length),
      confirmText: 'Arkivo',
      icon: '📦',
      danger: false,
    });
    if (!confirmed) return;
    await runAction(async () => {
      const res = await api.archiveDoneOrders(ids);
      ui.showToast(archivedOrdersToast(res.data?.count || 0));
      await refreshData();
    }, 'Porositë nuk u arkivuan.');
  });

  document.getElementById('admin-bulk-clear-calls-btn')?.addEventListener('click', async () => {
    const ids = state.calls.map((call) => call.id);
    if (!ids.length) {
      ui.showToast('Nuk ka thirrje aktive për mbyllje.');
      return;
    }
    const confirmed = await ui.confirm({
      title: 'Mbyll të gjitha thirrjet?',
      message: callCloseConfirmMessage(ids.length),
      confirmText: 'Mbyll',
      icon: '🔔',
      danger: true,
    });
    if (!confirmed) return;
    await runAction(async () => {
      const res = await api.archiveWaiterCalls(ids);
      ui.showToast(closedCallsToast(res.data?.count || 0));
      await refreshData();
    }, 'Thirrjet nuk u mbyllën.');
  });

  document.getElementById('clear-archive-btn')?.addEventListener('click', async () => {
    const archivedOrders = state.archiveOrders.filter((order) => Boolean(order.deleted_at)).length;
    const archivedCalls = state.archiveCalls.filter((call) => Boolean(call.deleted_at)).length;
    const total = archivedOrders + archivedCalls;
    if (!total) {
      ui.showToast('Nuk ka të dhëna të arkivuara për pastrim.');
      return;
    }

    const confirmed = await ui.confirm({
      title: 'Pastro arkivin?',
      message: `Do të fshihen përgjithmonë ${archivedOrders} porosi të arkivuara dhe ${archivedCalls} thirrje të mbyllura. Porositë/thirrjet aktive nuk preken.`,
      confirmText: 'Pastro',
      icon: '🧹',
      danger: true,
    });
    if (!confirmed) return;

    await runAction(async () => {
      const res = await api.clearArchive();
      ui.showToast(`U pastruan ${(res.data?.orders || 0) + (res.data?.calls || 0)} rreshta nga arkivi.`);
      await refreshData();
    }, 'Arkivi nuk u pastrua.');
  });

  ui.elements.zoneFiltersContainer?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-zone-filter]');
    if (!button) return;
    state.activeZone = button.dataset.zoneFilter || 'all';
    renderDashboard();
  });

  ui.elements.removeImageBtn?.addEventListener('click', () => {
    ui.elements.currentImageContainer.style.display = 'none';
    ui.elements.saveBtn.dataset.imageRemoved = 'true';
  });

  ui.elements.fImage?.addEventListener('change', () => {
    const file = ui.elements.fImage.files[0];
    const nameEl = document.getElementById('file-upload-name');
    if (nameEl) nameEl.textContent = file?.name || 'Asnjë skedar i zgjedhur';

    const { selectedImageContainer, selectedImagePreview, saveBtn } = ui.elements;
    if (!selectedImageContainer || !selectedImagePreview) return;

    if (selectedImagePreview.dataset.objectUrl) {
      URL.revokeObjectURL(selectedImagePreview.dataset.objectUrl);
      delete selectedImagePreview.dataset.objectUrl;
    }

    if (!file) {
      selectedImagePreview.src = '';
      selectedImageContainer.style.display = 'none';
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    selectedImagePreview.dataset.objectUrl = objectUrl;
    selectedImagePreview.src = objectUrl;
    selectedImageContainer.style.display = 'block';

    if (saveBtn) delete saveBtn.dataset.imageRemoved;
  });

  document.addEventListener('click', handleGlobalClick);
}

async function handleGlobalClick(event) {
  const actionElement = event.target.closest('[data-action]');

  if (actionElement) {
    const { action, itemId, orderId, callId, status } = actionElement.dataset;

    if (action === 'set-order-status') {
      await runAction(async () => {
        await api.updateStatus(orderId, status);
        ui.showToast(`Statusi u bë ${status}`);
        await refreshData();
      }, 'Statusi nuk u ndryshua.');
      return;
    }

    if (action === 'delete-order') {
      const order = state.orders.find((item) => String(item.id) === String(orderId));
      if (!order || order.status !== 'done') {
        ui.showToast('Porosia duhet të jetë “E gatshme” para arkivimit.', 'error');
        return;
      }
      await runAction(async () => {
        await api.deleteOrder(orderId);
        ui.showToast('Porosia u arkivua.');
        await refreshData();
      }, 'Porosia nuk u arkivua.');
      return;
    }

    if (action === 'acknowledge-waiter-call') {
      await runAction(async () => {
        await api.acknowledgeCall(callId);
        ui.showToast('Thirrja u pranua.');
        await refreshData();
      }, 'Thirrja nuk u pranua.');
      return;
    }

    if (action === 'delete-waiter-call') {
      await runAction(async () => {
        await api.deleteCall(callId);
        ui.showToast('Thirrja u mbyll.');
        await refreshData();
      }, 'Thirrja nuk u mbyll.');
      return;
    }

    if (action === 'toggle-menu-item') {
      const item = state.menu.find(i => String(i.id) === String(itemId));
      if (!item) return;
      await runAction(async () => {
        await api.saveMenuItem({ active: !item.active }, item.id);
        await refreshData();
      }, 'Aktivizimi dështoi.');
      return;
    }

    if (action === 'open-add-form') {
      ui.openAddForm();
      return;
    }

    if (action === 'edit-menu-item') {
      const item = state.menu.find(i => String(i.id) === String(itemId));
      if (item) ui.openEditForm(item);
      return;
    }

    if (action === 'approve-staff-device') {
      await runAction(async () => {
        await api.approveStaffDevice(actionElement.dataset.deviceId);
        ui.showToast('Pajisja u aprovua.');
        await refreshData();
      }, 'Pajisja nuk u aprovua.');
      return;
    }

    if (action === 'revoke-staff-device') {
      const confirmed = await ui.confirm({ title: 'Revoko pajisjen?', message: 'Kjo pajisje nuk do të mund të përdorë më Staff Mode pa aprovim të ri.', confirmText: 'Revoko', icon: '📱' });
      if (!confirmed) return;
      await runAction(async () => {
        await api.revokeStaffDevice(actionElement.dataset.deviceId);
        ui.showToast('Pajisja u revokua.', 'error');
        await refreshData();
      }, 'Pajisja nuk u revokua.');
      return;
    }

    if (action === 'delete-menu-item') {
      const confirmed = await ui.confirm({ title: 'Arkivo artikullin?', message: 'Artikulli largohet nga menyja aktive, por ruhet si i arkivuar.', confirmText: 'Arkivo', icon: '🍽️' });
      if (!confirmed) return;
      await runAction(async () => {
        const itemToDelete = state.menu.find(i => String(i.id) === String(itemId));
        if (itemToDelete?.image) await api.deleteMenuImage(itemToDelete.image);
        await api.deleteMenuItem(itemId);
        ui.showToast('Artikulli u arkivua.', 'error');
        await refreshData();
      }, 'Arkivimi dështoi.');
      return;
    }
  }

  if (event.target.id === 'form-cancel-btn' || (event.target.closest('#form-overlay') && !event.target.closest('.form-modal'))) {
    ui.closeForm();
    return;
  }

  if (event.target.id === 'save-btn') {
    await handleSave(event.target);
  }
}

async function runAction(callback, fallbackMessage) {
  try {
    await callback();
  } catch (error) {
    console.error(error);
    ui.showToast(error.message || fallbackMessage, 'error');
  }
}

async function handleSave(saveButton) {
  if (saveButton.disabled) return;
  saveButton.disabled = true;
  saveButton.textContent = 'Duke ruajtur...';

  const { editId, oldImageUrl, imageRemoved } = saveButton.dataset;
  const imageFile = ui.elements.fImage.files[0];
  let newImageUrl = null;

  try {
    if (!ui.elements.fName.value.trim()) throw new Error('Emri mungon.');
    if (!ui.elements.fCat.value) throw new Error('Kategoria mungon.');

    if (editId && imageRemoved === 'true' && oldImageUrl) {
      await api.deleteMenuImage(oldImageUrl).catch((error) => {
        console.warn('Old image delete skipped:', error);
      });
    }

    if (imageFile) {
      ui.showToast('Duke optimizuar foton...');
      const optimizedImage = await utils.optimizeImage(imageFile);
      ui.showToast('Duke ngarkuar foton...');
      newImageUrl = await api.uploadMenuImage(optimizedImage);
      if (newImageUrl && editId && oldImageUrl) {
        await api.deleteMenuImage(oldImageUrl).catch((error) => {
          console.warn('Old image delete skipped:', error);
        });
      }
    }

    const payload = {
      name: ui.elements.fName.value.trim(),
      price: Number.parseFloat(ui.elements.fPrice.value) || 0,
      description: ui.elements.fDesc.value.trim(),
      category: ui.elements.fCat.value,
      active: true,
    };

    if (newImageUrl) payload.image = newImageUrl;
    else if (imageRemoved === 'true') payload.image = null;
    else if (editId) payload.image = oldImageUrl || null;

    await api.saveMenuItem(payload, editId);
    ui.showToast(editId ? 'U përditësua!' : 'U shtua!');
    ui.closeForm();
    await refreshData();
  } catch (error) {
    console.error('Save process failed:', error);
    ui.showToast(error.message || 'Ruajtja dështoi.', 'error');
    if (newImageUrl) await api.deleteMenuImage(newImageUrl).catch(console.error);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Ruaj';
  }
}

document.addEventListener('DOMContentLoaded', init);
