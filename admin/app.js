import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://uydjwcfzmsxikjftyngh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5ZGp3Y2Z6bXN4aWtqZnR5bmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMTc2NjgsImV4cCI6MjA4OTY5MzY2OH0.CfL1KYWcQ0mqzYEft9MOs2079ECYWCyakQKvtxscwX8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const catNames = { supat: 'Supa', senduic: 'Sanduiç', burger: 'Burgera', rizoto: 'Rizoto', sallata: 'Sallata', pasta: 'Pasta', pica: 'Pica', pule: 'Mish Pule', misherat: 'Mishërat', deti: 'Ushqim Deti', desert: 'Ëmbëlsira' };

let ORDERS = [];
let MENU = [];
let WAITER_CALLS = [];
let editingId = null;
let searchTerm = '';
let activeCallId = null;

// --- UI HELPERS ---
function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    if(!t) return;
    t.textContent = msg;
    t.className = `toast ${type} show`;
    setTimeout(() => { t.className = 'toast'; }, 2500);
    if(type === 'warning') new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => {});
}

let dialogCallback = null;
window.showDialog = function(title, sub, icon, callback) {
    document.getElementById('dialog-title').textContent = title;
    document.getElementById('dialog-sub').textContent = sub;
    document.getElementById('dialog-icon').textContent = icon;
    dialogCallback = callback;
    document.getElementById('dialog-overlay').classList.add('open');
};

window.closeDialog = function() {
    document.getElementById('dialog-overlay').classList.remove('open');
    dialogCallback = null;
};

document.getElementById('dialog-confirm-btn').onclick = async () => {
    if (dialogCallback) await dialogCallback();
    closeDialog();
};

function updateTime() {
    const timeEl = document.getElementById('orders-time');
    if (timeEl) timeEl.textContent = new Date().toLocaleTimeString('sq-AL', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

// --- NAVIGATION ---
window.showPage = function(name, btn) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const targetPage = document.getElementById('page-' + name);
    if (targetPage) targetPage.classList.add('active');
    const targetBtn = btn || document.getElementById('nav-' + name);
    if (targetBtn) targetBtn.classList.add('active');
    localStorage.setItem('activePage', name);
    if(name === 'menu') loadMenu(); else { loadOrders(); loadWaiterCalls(); }
};

// --- ORDERS LOGIC ---
async function loadOrders() {
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    ORDERS = data || [];
    renderOrders();
}

function renderOrders() {
    const newCount = ORDERS.filter(o => o.status === 'new').length;
    const badge = document.getElementById('new-badge');
    if(badge) { badge.textContent = newCount; badge.style.display = newCount > 0 ? 'block' : 'none'; }
    const revenue = ORDERS.reduce((s, o) => s + parseFloat(o.total || 0), 0);
    document.getElementById('stat-new').textContent = newCount;
    document.getElementById('stat-revenue').textContent = revenue.toFixed(2) + ' €';
    const container = document.getElementById('orders-container');
    if(!container) return;
    const statusLabel = { new:'E re', preparing:'Në përgatitje', done:'E gatshme' };
    const statusClass = { new:'status-new', preparing:'status-preparing', done:'status-done' };
    container.innerHTML = ORDERS.map(order => {
        const time = new Date(order.created_at).toLocaleTimeString('sq-AL', { hour:'2-digit', minute:'2-digit' });
        const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]');
        return `
            <div class="order-card ${order.status}">
                <div class="order-header">
                    <div><div class="order-table">Tavolina ${order.table_number}</div><div class="order-time">${time}</div></div>
                    <span class="order-status ${statusClass[order.status]}">${statusLabel[order.status]}</span>
                </div>
                <div class="order-items">${items.map(i => `<div class="order-line"><span>x${i.qty} ${i.name}</span><span>${(i.price*i.qty).toFixed(2)} €</span></div>`).join('')}</div>
                <div class="order-total-row"><span>Total</span><span class="order-total-price">${parseFloat(order.total).toFixed(2)} €</span></div>
                <div class="order-actions">
                    ${order.status === 'new' ? `<button class="btn btn-primary" onclick="setStatus(${order.id},'preparing')">Fillo</button>` : ''}
                    ${order.status === 'preparing' ? `<button class="btn btn-green" onclick="setStatus(${order.id},'done')">✓ Gati</button>` : ''}
                    <button class="btn btn-red" onclick="confirmDeleteOrder(${order.id})">Fshi</button>
                </div>
            </div>`;
    }).join('');
}

window.setStatus = async (id, status) => { await supabase.from('orders').update({ status }).eq('id', id); loadOrders(); };
window.confirmDeleteOrder = (id) => {
    window.showDialog('Fshi porosinë?', 'Do të hiqet nga lista.', '🗑️', async () => {
        await supabase.from('orders').delete().eq('id', id);
        loadOrders();
        showToast('U fshi');
    });
};

// --- WAITER CALLS LOGIC (EXTENDED BUTTONS) ---
async function loadWaiterCalls() {
    const { data } = await supabase.from('waiter_calls').select('*').order('created_at', { ascending: false });
    WAITER_CALLS = data || [];
    renderWaiterCalls();
}

function renderWaiterCalls() {
    const container = document.getElementById('waiter-calls-container');
    if(!container) return;

    if (WAITER_CALLS.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'grid'; // Grid për t'i renditur bukur
    container.innerHTML = WAITER_CALLS.map(c => `
        <div class="extended-call-btn" onclick="openCallDetails(${c.id}, '${c.table_number}')">
            <div class="call-btn-main">
                <span class="call-btn-icon">🛎️</span>
                <div class="call-btn-text">
                    <span class="call-btn-label">Thirrje Aktive</span>
                    <span class="call-btn-table">Tavolina ${c.table_number}</span>
                </div>
            </div>
            <span class="call-btn-arrow">→</span>
        </div>
    `).join('');
}

window.openCallDetails = (id, tableNumber) => {
    activeCallId = id;
    document.getElementById('call-table-num').textContent = tableNumber;
    const activeOrder = ORDERS.find(o => parseInt(o.table_number) === parseInt(tableNumber) && o.status !== 'done');
    const itemsContainer = document.getElementById('call-order-items');
    if (activeOrder && activeOrder.items) {
        const items = Array.isArray(activeOrder.items) ? activeOrder.items : JSON.parse(activeOrder.items || '[]');
        itemsContainer.innerHTML = items.map(i => `<div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border);"><span>x${i.qty} ${i.name}</span><span>${(i.price*i.qty).toFixed(2)} €</span></div>`).join('');
    } else {
        itemsContainer.innerHTML = '<div style="color: var(--muted); text-align: center; padding: 25px;">Nuk ka porosi aktive për këtë tavolinë.</div>';
    }
    document.getElementById('call-details-overlay').classList.add('open');
};

window.closeCallDetails = () => { document.getElementById('call-details-overlay').classList.remove('open'); activeCallId = null; };
window.resolveActiveCall = async () => {
    if (!activeCallId) return;
    const { error } = await supabase.from('waiter_calls').delete().eq('id', activeCallId);
    if(!error) { showToast('Thirrja u mbyll'); loadWaiterCalls(); closeCallDetails(); }
};

// --- MENU LOGIC ---
async function loadMenu() {
    const { data } = await supabase.from('menu').select('*').order('category');
    MENU = data || [];
    renderMenuTable();
}

function renderMenuTable() {
    const filtered = MENU.filter(i => !searchTerm || i.name.toLowerCase().includes(searchTerm.toLowerCase()));
    document.getElementById('menu-rows').innerHTML = filtered.map(item => `
        <div class="menu-row">
            <div class="menu-image-cell" style="background-image:url('${item.image}')"></div>
            <div><div class="menu-name">${item.name}</div><div class="menu-desc">${item.description || ''}</div></div>
            <div><span class="cat-pill">${catNames[item.category] || item.category}</span></div>
            <div class="menu-price">${parseFloat(item.price).toFixed(2)} €</div>
            <div>
                <label class="toggle-switch">
                    <input type="checkbox" ${item.active ? 'checked' : ''} onchange="toggleItem(${item.id}, this.checked)">
                    <div class="toggle-track"></div><div class="toggle-thumb"></div>
                </label>
            </div>
            <div class="menu-actions"><button class="icon-btn" onclick="openEditForm(${item.id})">✎</button><button class="icon-btn danger" onclick="confirmDeleteItem(${item.id})">✕</button></div>
        </div>`).join('');
}

window.filterMenu = (val) => { searchTerm = val; renderMenuTable(); };
window.toggleItem = async (id, active) => { await supabase.from('menu').update({ active }).eq('id', id); showToast(active ? 'Aktiv' : 'Jo Aktiv'); };
window.confirmDeleteItem = (id) => { window.showDialog('Fshi artikullin?', 'Nuk mund të kthehet.', '🗑️', async () => { await supabase.from('menu').delete().eq('id', id); loadMenu(); }); };
window.openAddForm = () => { editingId = null; document.getElementById('form-title').textContent = 'Shto artikull'; ['f-image','f-name','f-desc','f-price'].forEach(id => document.getElementById(id).value = ''); document.getElementById('form-overlay').classList.add('open'); };
window.openEditForm = (id) => {
    const item = MENU.find(i => i.id === id);
    if (!item) return;
    editingId = id;
    document.getElementById('f-image').value = item.image || '';
    document.getElementById('f-name').value = item.name;
    document.getElementById('f-desc').value = item.description || '';
    document.getElementById('f-price').value = item.price;
    document.getElementById('f-cat').value = item.category;
    document.getElementById('form-overlay').classList.add('open');
};

window.saveItem = async () => {
    const data = { name: document.getElementById('f-name').value, price: parseFloat(document.getElementById('f-price').value), image: document.getElementById('f-image').value, description: document.getElementById('f-desc').value, category: document.getElementById('f-cat').value, active: true };
    const { error } = editingId ? await supabase.from('menu').update(data).eq('id', editingId) : await supabase.from('menu').insert(data);
    if (!error) { closeForm(); loadMenu(); showToast('U ruajt'); }
};

window.closeForm = () => document.getElementById('form-overlay').classList.remove('open');

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    updateTime(); setInterval(updateTime, 1000);
    const saved = localStorage.getItem('activePage') || 'orders';
    window.showPage(saved);
    supabase.channel('custom-all-channel').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadOrders())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_calls' }, (payload) => { if (payload.eventType === 'INSERT') showToast('Thirrje e re!', 'warning'); loadWaiterCalls(); }).subscribe();
    loadOrders(); loadWaiterCalls();
});