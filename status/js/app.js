import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CONFIG } from './config.js';
import * as utils from './utils.js';
import * as ui from './ui.js';

// Inicializimi i klientit Supabase
const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

// Gjendja e aplikacionit (App State)
const state = {
    orderId: utils.parsePositiveInteger(new URLSearchParams(window.location.search).get('id')),
    showAll: new URLSearchParams(window.location.search).get('all') === 'true',
    tableNumber: null,
    isInitialLoad: true
};

const elements = {
    mainContent: document.getElementById('main-content'),
    backButton: document.getElementById('btn-back'),
    waiterButton: document.getElementById('waiter-btn')
};

// --- BOOTSTRAP ---
document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    refreshCycle();
    // Refresh periodik
    window.setInterval(refreshCycle, CONFIG.statusRefreshIntervalMs);
});

function initEvents() {
    elements.backButton?.addEventListener('click', handleBackNavigation);
    elements.waiterButton?.addEventListener('click', handleWaiterCall);
    elements.mainContent?.addEventListener('click', handleActionClicks);
}

// --- LOGJIKA KRYESORE ---

async function refreshCycle() {
    const activeIds = utils.getActiveOrderIds(CONFIG.activeOrdersStorageKey);
    const idsToFetch = state.showAll ? activeIds : (state.orderId ? [state.orderId] : []);

    if (idsToFetch.length === 0) {
        ui.renderEmptyState(elements.mainContent, 'Nuk u gjet asnjë porosi aktive.');
        return;
    }

    try {
        const data = await fetchOrderData(idsToFetch);
        updateUI(data, activeIds);
    } catch (error) {
        console.error('[App Error] Fetch failed:', error);
        if (state.isInitialLoad) {
            ui.renderEmptyState(elements.mainContent, 'Gabim gjatë lidhjes me serverin.');
        }
    } finally {
        state.isInitialLoad = false;
    }
}

async function fetchOrderData(ids) {
    // Ekzekutojmë dy kërkesa paralele për performancë (Parallel Fetch)
    const [busyRes, ordersRes] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', ['new', 'preparing']),
        supabase.from('orders').select('*').in('id', ids).order('created_at', { ascending: true })
    ]);

    if (ordersRes.error) throw ordersRes.error;
    
    return {
        orders: ordersRes.data,
        isBusy: (busyRes.count || 0) > 5
    };
}

function updateUI({ orders, isBusy }, activeIds) {
    if (!orders || orders.length === 0) {
        ui.renderEmptyState(elements.mainContent, 'Porosia nuk u gjet.');
        return;
    }

    // Përditësojmë referencën e tavolinës nga porosia e parë
    state.tableNumber = orders[0].table_number;
    
    // Sinkronizojmë butonat e navigimit
    ui.toggleElement(elements.backButton, true);
    ui.toggleElement(elements.waiterButton, !!state.tableNumber);

    // Vendosim modalitetin e shfaqjes (Single vs Multiple)
    if (orders.length === 1 && !state.showAll) {
        elements.mainContent.classList.add('single-mode');
        elements.mainContent.innerHTML = ui.renderOrderCard(orders[0], activeIds.indexOf(orders[0].id) + 1, isBusy);
    } else {
        elements.mainContent.classList.remove('single-mode');
        elements.mainContent.innerHTML = ui.renderMultipleOrders(orders, activeIds, isBusy);
    }
}

// --- EVENT HANDLERS ---

function handleBackNavigation() {
    const target = state.tableNumber ? `../index.html?table=${state.tableNumber}` : '../index.html';
    window.location.href = target;
}

async function handleWaiterCall() {
    if (!state.tableNumber || elements.waiterButton.disabled) return;

    ui.setWaiterLoading(elements.waiterButton, true);

    const { error } = await supabase
        .from('waiter_calls')
        .insert({ table_number: state.tableNumber, status: 'new' });

    if (error) {
        console.error('Waiter call failed:', error);
        ui.setWaiterLoading(elements.waiterButton, false);
        return;
    }

    // Cooldown period
    setTimeout(() => ui.setWaiterLoading(elements.waiterButton, false), CONFIG.waiterCooldownMs);
}

async function handleActionClicks(event) {
    const ratingBtn = event.target.closest('[data-action="send-rating"]');
    if (!ratingBtn) return;

    const { orderId, rating } = ratingBtn.dataset;
    ui.updateRatingUI(orderId, 'loading');

    const { error } = await supabase
        .from('orders')
        .update({ rating: rating })
        .eq('id', orderId);

    if (error) {
        ui.updateRatingUI(orderId, 'error');
    } else {
        ui.updateRatingUI(orderId, 'success');
    }
}