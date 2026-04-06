import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://uydjwcfzmsxikjftyngh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5ZGp3Y2Z6bXN4aWtqZnR5bmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMTc2NjgsImV4cCI6MjA4OTY5MzY2OH0.CfL1KYWcQ0mqzYEft9MOs2079ECYWCyakQKvtxscwX8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const urlParams = new URLSearchParams(window.location.search);
const orderId = urlParams.get('id');
const showAll = urlParams.get('all') === 'true';

async function fetchStatus() {
    const activeIds = JSON.parse(localStorage.getItem('activeOrdersList') || "[]");
    let idsToFetch = showAll ? activeIds : (orderId ? [parseInt(orderId)] : []);

    if (idsToFetch.length === 0) {
        document.getElementById('main-content').innerHTML = "<p style='text-align:center; color:var(--muted);'>Nuk u gjet asnjë porosi aktive.</p>";
        return;
    }

    const { count: totalBusy } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['new', 'preparing']);

    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .in('id', idsToFetch)
        .order('created_at', { ascending: true }); 

    if (error || !orders || orders.length === 0) return;

    // Shto butonin e kamarierit automatikisht nëse nuk ekziston
    injectWaiterButton(orders[0].table_number);

    const backBtn = document.getElementById('btn-back');
    if (backBtn) {
        backBtn.onclick = () => {
            window.location.href = `../index.html?table=${orders[0].table_number}`;
        };
    }

    const isBusy = totalBusy > 5;

    if (orders.length === 1 && !showAll) {
        renderSingleOrder(orders[0], activeIds, isBusy);
    } else {
        renderMultipleOrders(orders, isBusy);
    }
}

function renderSingleOrder(order, activeIds, isBusy) {
    const container = document.getElementById('main-content');
    container.classList.add('single-mode');
    
    const orderIndex = activeIds.indexOf(order.id) + 1;
    container.innerHTML = generateOrderCardHTML(order, orderIndex, isBusy);
}

function renderMultipleOrders(orders, isBusy) {
    const container = document.getElementById('main-content');
    container.classList.remove('single-mode');
    
    const activeIds = JSON.parse(localStorage.getItem('activeOrdersList') || "[]");
    const grandTotal = orders.reduce((sum, order) => sum + parseFloat(order.total), 0);

    let html = orders.map(order => {
        const orderIndex = activeIds.indexOf(order.id) + 1;
        return generateOrderCardHTML(order, orderIndex, isBusy);
    }).join('');

    html += `
        <div class="grand-total-bar">
            <span class="total-text">Totali i Përgjithshëm</span>
            <div class="total-price">${grandTotal.toFixed(2)}<span>€</span></div>
        </div>
    `;

    container.innerHTML = html;
}

function generateOrderCardHTML(order, index, isBusy) {
    const progressWidth = order.status === 'new' ? '33.3%' : (order.status === 'preparing' ? '66.6%' : '100%');
    const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]');

    let statusText = '';
    if (order.status === 'new') {
        statusText = isBusy
            ? "U dërgua! Në radhë për t'u përgatitur." 
            : "U dërgua! Së shpejti në punë.";
    } else if (order.status === 'preparing') {
        statusText = "Duke u përgatitur...";
    } else if (order.status === 'done') {
        statusText = "Gati! Ju bëftë mirë.";
    }

    // Kutia e vlerësimit shfaqet vetëm kur porosia është Gati
    let ratingHtml = '';
    if (order.status === 'done' && !order.rating) {
        ratingHtml = `
            <div id="rating-box-${order.id}" style="text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.05);">
                <p style="margin-bottom: 10px; font-size: 13px; color: var(--muted);">Si ishte ushqimi?</p>
                <div style="display: flex; justify-content: center; gap: 20px; font-size: 26px;">
                    <span style="cursor:pointer;" onclick="window.sendRating(${order.id}, 'bad')">😞</span>
                    <span style="cursor:pointer;" onclick="window.sendRating(${order.id}, 'ok')">😐</span>
                    <span style="cursor:pointer;" onclick="window.sendRating(${order.id}, 'good')">😍</span>
                </div>
            </div>`;
    } else if (order.rating) {
        ratingHtml = `<div style="text-align:center; margin-top:15px; color:#4CAF7D; font-size:13px; font-weight:bold;">Faleminderit për vlerësimin! ❤️</div>`;
    }

    return `
        <div class="order-card">
            <div class="order-header" style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 14px; font-weight: 700; color: var(--accent); text-transform: uppercase;">Porosia ${index || 1}</div>
                <div style="font-size: 11px; color: var(--muted); margin-top: 4px;">Tavolina ${order.table_number}</div>
            </div>

            <div class="status-visual">
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${progressWidth}"></div>
                </div>
                <div class="status-labels">
                    <span class="label ${order.status==='new'?'active':''}">U dërgua</span>
                    <span class="label ${order.status==='preparing'?'active':''}">Në kuzhinë</span>
                    <span class="label ${order.status==='done'?'active':''}">Gati</span>
                </div>
            </div>

            <div class="status-message-box" style="background:rgba(255,255,255,0.03); padding:15px; border-radius:15px; text-align:center; font-size:13px; border:1px solid var(--border); margin-top: 30px;">
                ${statusText}
            </div>

            <div class="items-list" style="margin-top: 20px;">
                ${items.map(i => `
                    <div class="item-row">
                        <span>x${i.qty} ${i.name}</span>
                        <span>${(i.qty * i.price).toFixed(2)}€</span>
                    </div>
                `).join('')}
                <div class="total-row">
                    <span>Total</span>
                    <span>${parseFloat(order.total).toFixed(2)} €</span>
                </div>
            </div>
            ${ratingHtml}
        </div>`;
}

// Funksioni për dërgimin e vlerësimit (Rating)
window.sendRating = async (orderId, ratingValue) => {
    const box = document.getElementById(`rating-box-${orderId}`);
    if(box) box.innerHTML = '<p style="color: #4CAF7D; font-weight: bold; font-size: 13px; margin-top: 10px;">Faleminderit! ❤️</p>';
    await supabase.from('orders').update({ rating: ratingValue }).eq('id', orderId);
};

// Funksioni për thirrjen e kamarierit
window.callWaiter = async (tableNum) => {
    const btn = document.getElementById('waiter-btn');
    if(btn) { btn.innerHTML = '⏳ Po vjen...'; btn.disabled = true; }
    await supabase.from('waiter_calls').insert({ table_number: tableNum, status: 'new' });
    setTimeout(() => { if(btn) { btn.innerHTML = '🔔 Kamarieri'; btn.disabled = false; } }, 60000);
};

// Krijon butonin dinamikisht
function injectWaiterButton(tableNum) {
    if (!document.getElementById('waiter-btn')) {
        const btn = document.createElement('button');
        btn.id = 'waiter-btn';
        btn.innerHTML = '🔔 Kamarieri';
        btn.style.cssText = 'position: fixed; top: 20px; right: 16px; background: rgba(255,255,255,0.1); border: 1px solid var(--border); backdrop-filter: blur(10px); color: white; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; z-index: 1000; box-shadow: 0 4px 15px rgba(0,0,0,0.3); transition: 0.3s;';
        btn.onclick = () => window.callWaiter(tableNum);
        document.body.appendChild(btn);
    }
}

fetchStatus();
setInterval(fetchStatus, 10000);