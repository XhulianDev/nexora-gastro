import { formatMoney, formatMoneyCompact, escapeHtml, toNumber } from './utils.js';
import { STATUS_MESSAGES } from './config.js';

/**
 * Renderon një kartë të vetme porosie
 */
export const renderOrderCard = (order, index, isBusy) => {
    const statusMsg = isBusy 
        ? (STATUS_MESSAGES[order.status]?.busy || STATUS_MESSAGES.new.busy)
        : (STATUS_MESSAGES[order.status]?.normal || STATUS_MESSAGES.new.normal);
    
    const progressClass = getProgressClass(order.status);
    const items = parseItems(order.items);

    return `
        <article class="order-card" id="order-${order.id}">
            <header class="order-header">
                <div class="order-index">Porosia ${index}</div>
                <div class="order-table">Tavolina ${escapeHtml(order.table_number)}</div>
            </header>

            <div class="status-visual">
                <div class="progress-bar ${progressClass}"></div>
                <div class="status-labels">
                    <span class="status-label ${order.status === 'new' ? 'active' : ''}">U dërgua</span>
                    <span class="status-label ${order.status === 'preparing' ? 'active' : ''}">Në kuzhinë</span>
                    <span class="status-label ${order.status === 'done' ? 'active' : ''}">Gati</span>
                </div>
            </div>

            <div class="status-message-box">
                ${escapeHtml(statusMsg)}
            </div>

            <div class="items-list">
                ${items.map(item => `
                    <div class="item-row">
                        <span>x${toNumber(item.qty)} ${escapeHtml(item.name || '')}</span>
                        <span>${formatMoneyCompact(toNumber(item.qty) * toNumber(item.price))}</span>
                    </div>
                `).join('')}
                <div class="total-row">
                    <span>Total</span>
                    <span>${formatMoney(order.total)}</span>
                </div>
            </div>

            <div class="rating-container" id="rating-area-${order.id}">
                ${renderRatingSection(order)}
            </div>
        </article>
    `;
};

/**
 * Renderon listën e porosive dhe totalin e përgjithshëm
 */
export const renderMultipleOrders = (orders, activeIds, isBusy) => {
    const grandTotal = orders.reduce((sum, o) => sum + toNumber(o.total), 0);
    const cardsHtml = orders.map(o => renderOrderCard(o, activeIds.indexOf(o.id) + 1, isBusy)).join('');

    return `
        ${cardsHtml}
        <div class="grand-total-bar">
            <span class="total-text">Totali i Përgjithshëm</span>
            <div class="total-price">${formatMoney(grandTotal)}</div>
        </div>
    `;
};

export const renderEmptyState = (container, msg) => {
    if (!container) return;
    container.innerHTML = `<div class="empty-state">${escapeHtml(msg)}</div>`;
};

export const toggleElement = (el, show) => {
    if (el) el.hidden = !show;
};

export const setWaiterLoading = (btn, isLoading) => {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.textContent = isLoading ? '⏳ Po vjen...' : '🔔 Kamarieri';
};

/**
 * Menaxhon ndryshimin e UI pas votimit
 */
export const updateRatingUI = (orderId, state) => {
    const area = document.getElementById(`rating-area-${orderId}`);
    if (!area) return;

    if (state === 'loading') area.style.opacity = '0.5';
    if (state === 'success') area.innerHTML = '<div class="rating-thanks">Faleminderit! ❤️</div>';
    if (state === 'error') {
        area.style.opacity = '1';
        area.innerHTML += '<p style="color:red; font-size:10px">Dështoi, provo përsëri.</p>';
    }
};

// --- FUNKSIONE NDIHMËSE TË BRENDSHME (Private Helpers) ---

function getProgressClass(status) {
    if (status === 'done') return 'progress-bar--done';
    if (status === 'preparing') return 'progress-bar--preparing';
    return 'progress-bar--new';
}

function renderRatingSection(order) {
    if (order.status !== 'done') return '';
    if (order.rating) return '<div class="rating-thanks">Faleminderit për vlerësimin! ❤️</div>';

    return `
        <div class="rating-box">
            <p class="rating-question">Si ishte ushqimi?</p>
            <div class="rating-actions">
                <button class="rating-btn" data-action="send-rating" data-order-id="${order.id}" data-rating="bad">😞</button>
                <button class="rating-btn" data-action="send-rating" data-order-id="${order.id}" data-rating="ok">😐</button>
                <button class="rating-btn" data-action="send-rating" data-order-id="${order.id}" data-rating="good">😍</button>
            </div>
        </div>
    `;
}

function parseItems(value) {
    if (Array.isArray(value)) return value;
    try { return JSON.parse(value || '[]'); } catch { return []; }
}