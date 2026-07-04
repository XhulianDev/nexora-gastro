import { CATEGORY_LABELS, ORDER_STATUS } from './constants.js';
import { escapeHtml, formatMoney } from './utils.js';
import { state, elements, findMenuItemById, getUpsellSuggestion } from './state.js';

/**
 * Përditëson etiketën e tavolinës në krye të faqes.
 */
export function setTableLabel() {
  if (elements.tableLabel) {
    elements.tableLabel.textContent = `Tavolina ${state.tableNumber}`;
  }
}

/**
 * Dërgon përdoruesit te një kategori specifike, mbyll modalin dhe bën scroll.
 */
export function navigateToCategory(category) {
  state.activeCategory = category;
  renderCategories();
  renderMenu();
  closeModal();

  setTimeout(() => {
    elements.menuList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

/**
 * Renderon butonat e kategorive në shiritin horizontal.
 */
export function renderCategories() {
  if (!elements.categoryBar) return;

  const categoryList = [...new Set(state.menu.map(item => item.category).filter(Boolean))];

  if (categoryList.length === 0) {
    elements.categoryBar.hidden = true;
    return;
  }

  elements.categoryBar.hidden = false;
  elements.categoryBar.innerHTML = [
    renderCategoryButton('all', 'Të gjitha', state.activeCategory === 'all'),
    ...categoryList.map(cat => 
      renderCategoryButton(cat, CATEGORY_LABELS[cat] || cat, state.activeCategory === cat)
    )
  ].join('');
}

function renderCategoryButton(category, label, isActive) {
  return `
    <button type="button" 
            class="category-btn ${isActive ? 'active' : ''}" 
            data-category="${escapeHtml(category)}">
      ${escapeHtml(label)}
    </button>`;
}

export function renderMenuLoading() {
  if (!elements.categoryBar || !elements.menuList) return;

  elements.categoryBar.hidden = true;
  elements.menuList.innerHTML = `
    <section class="menu-state menu-state--loading" aria-live="polite">
      <div class="menu-state__badge">Menuja</div>
      <h2>Duke ngarkuar menynë...</h2>
      <p>Ju lutemi prisni pak. Po marrim artikujt aktivë të restorantit.</p>
      <div class="menu-skeleton" aria-hidden="true">
        <div></div><div></div><div></div>
      </div>
    </section>
  `;
}

export function renderMenuError() {
  if (!elements.menuList) return;

  elements.menuList.innerHTML = `
    <section class="menu-state menu-state--error" role="alert">
      <div class="menu-state__badge">Njoftim</div>
      <h2>Menuja nuk u ngarkua.</h2>
      <p>Provoni përsëri. Nëse problemi vazhdon, thërrisni kamarierin nga tavolina.</p>
      <button class="button button--primary menu-state__action" type="button" data-action="retry-menu">Provo përsëri</button>
    </section>
  `;
}

export function renderEmptyMenu() {
  if (!elements.menuList) return;

  elements.menuList.innerHTML = `
    <section class="menu-state">
      <div class="menu-state__badge">Menuja</div>
      <h2>Nuk ka artikuj të disponueshëm.</h2>
      <p>Ju lutemi thërrisni kamarierin për ndihmë ose provoni përsëri më vonë.</p>
    </section>
  `;
}

/**
 * Renderon listën e produkteve të grupuara sipas kategorive.
 */
export function renderMenu() {
  if (!elements.menuList) return;

  if (!state.menu.length) {
    renderEmptyMenu();
    return;
  }

  const filteredMenu = state.activeCategory === 'all' 
    ? state.menu 
    : state.menu.filter(item => item.category === state.activeCategory);

  if (!filteredMenu.length) {
    renderEmptyMenu();
    return;
  }

  const categoriesInView = [...new Set(filteredMenu.map(item => item.category).filter(Boolean))];

  elements.menuList.innerHTML = categoriesInView.map(category => `
    <section class="section">
      <h2 class="section-title">${escapeHtml(CATEGORY_LABELS[category] || category)}</h2>
      <div class="items-grid">
        ${filteredMenu.filter(item => item.category === category).map(renderMenuItemCard).join('')}
      </div>
    </section>
  `).join('');
}

function renderMenuItemCard(item) {
  const quantity = state.cart[item.id] || 0;
  const imageStyle = item.image ? `style="background-image: url('${escapeHtml(item.image)}');"` : '';

  return `
    <article class="item-card">
      <div class="item-image" ${imageStyle}></div>
      <div class="item-info">
        <div class="item-name">${escapeHtml(item.name || '')}</div>
        <div class="item-desc">${escapeHtml(item.description || '')}</div>
        <div class="item-price">${formatMoney(item.price)}</div>
      </div>
      ${quantity > 0 ? `
        <div class="qty-ctrl">
          <button class="qty-btn" data-action="change-qty" data-item-id="${item.id}" data-delta="-1">-</button>
          <span class="qty-value">${quantity}</span>
          <button class="qty-btn" data-action="change-qty" data-item-id="${item.id}" data-delta="1">+</button>
        </div>` : `
        <button class="button button--primary icon-btn" data-action="change-qty" data-item-id="${item.id}" data-delta="1">+</button>
      `}
    </article>
  `;
}

/**
 * Përditëson shiritin e shportës (Cart Bar).
 */
export function updateCartBar() {
  const entries = Object.entries(state.cart);
  const totalItems = entries.reduce((sum, [, qty]) => sum + qty, 0);
  const totalPrice = entries.reduce((sum, [id, qty]) => {
    const item = findMenuItemById(id);
    return sum + (item ? parseFloat(item.price) * qty : 0);
  }, 0);

  if (elements.cartTotal) elements.cartTotal.textContent = formatMoney(totalPrice);
  if (elements.cartCount) elements.cartCount.textContent = totalItems > 0 ? `(${totalItems})` : '';
  
  if (elements.cartPreview) {
    elements.cartPreview.innerHTML = entries.map(([id, qty]) => {
      const item = findMenuItemById(id);
      if (!item) return '';
      return `
        <div class="preview-item">
          <span class="preview-item__name">${escapeHtml(item.name)}</span>
          <div class="preview-item__qty-box">
            <button class="preview-item__qty-btn" data-action="change-qty" data-item-id="${item.id}" data-delta="-1">-</button>
            <span class="preview-item__qty-value">${qty}</span>
            <button class="preview-item__qty-btn" data-action="change-qty" data-item-id="${item.id}" data-delta="1">+</button>
          </div>
          <span class="preview-item__price">${formatMoney(parseFloat(item.price) * qty)}</span>
        </div>`;
    }).join('');
  }

  elements.cartBar?.classList.toggle('visible', totalItems > 0);
  document.body.classList.toggle('cart-active', totalItems > 0);

  requestAnimationFrame(() => {
    if (!elements.cartBar || totalItems === 0) {
      document.documentElement.style.setProperty('--cart-spacer', '0px');
      return;
    }

    const cartHeight = elements.cartBar.offsetHeight || 0;
    document.documentElement.style.setProperty('--cart-spacer', `${cartHeight + 12}px`);
  });
}

/**
 * Menaxhimi i Modalit
 */
export function openModal() {
  if (Object.keys(state.cart).length === 0) return;
  renderModalContent();
  elements.overlay?.classList.add('is-visible');
}

export function closeModal() {
  elements.overlay?.classList.remove('is-visible');
}

export function renderModalContent() {
  if (!elements.modalBody) return;

  const cartItems = Object.entries(state.cart).map(([id, qty]) => {
    const item = findMenuItemById(id);
    return item ? { ...item, qty } : null;
  }).filter(Boolean);

  if (cartItems.length === 0) return closeModal();

  const total = cartItems.reduce((sum, item) => sum + (parseFloat(item.price) * item.qty), 0);
  const suggestion = getUpsellSuggestion();

  elements.modalBody.innerHTML = `
    <div class="modal__items">
      ${cartItems.map(item => `
        <div class="modal__item">
          <div class="modal__item-info">
            <div class="modal__item-name">${escapeHtml(item.name)}</div>
            <div class="modal__item-price">${formatMoney(parseFloat(item.price) * item.qty)}</div>
          </div>
          <div class="qty-ctrl">
            <button class="qty-btn" data-action="change-qty" data-item-id="${item.id}" data-delta="-1">-</button>
            <span class="qty-value">${item.qty}</span>
            <button class="qty-btn" data-action="change-qty" data-item-id="${item.id}" data-delta="1">+</button>
          </div>
        </div>
      `).join('')}
    </div>
    
    ${suggestion ? `
      <div class="upsell">
        <div class="upsell__text">Sugjerim për ju</div>
        <div class="upsell__actions">
          <button class="upsell-btn" data-action="upsell-add" data-item-id="${suggestion.id}">
            Shto ${escapeHtml(suggestion.name)} <span>+${formatMoney(suggestion.price)}</span>
          </button>
          <button class="upsell-view-all-btn" data-action="view-category" data-category="${suggestion.category || 'all'}">
            Shihni të gjitha
          </button>
        </div>
      </div>` : ''}

    <textarea id="note" class="note-field" placeholder="Shënim për porosinë, p.sh. pa qepë, ekstra salcë..."></textarea>
    <button id="send-btn" class="button button--primary confirm-btn" data-action="send-order">
      Dërgo porosinë (${formatMoney(total)})
    </button>
  `;
}

export function renderStatusHub(orders, keepOpen = false) {
  if (!elements.statusHubContainer) return;
  if (!orders.length) {
    elements.statusHubContainer.innerHTML = '';
    return;
  }

  const hasDoneOrder = orders.some(o => o.status === 'done');
  
  elements.statusHubContainer.innerHTML = `
    <div class="status-hub">
      <div class="status-hub__main">
        <div class="status-hub__info">
          <div class="status-hub__dot ${hasDoneOrder ? 'is-done' : ''}"></div>
          <span><strong>${orders.length} Porosi</strong> aktive</span>
        </div>
        <button class="button button--ghost status-hub__toggle-btn" data-action="toggle-hub">Shiko listën</button>
      </div>
      <div id="hub-drop" class="status-hub__dropdown ${keepOpen ? 'is-open' : ''}">
        ${[...orders].reverse().map(order => {
          const statusInfo = ORDER_STATUS[order.status.toUpperCase()] || { label: order.status };
          return `
            <div class="status-hub__item">
              <span class="status-hub__item-title">Porosia #${String(order.id).slice(-4)}</span>
              <div class="status-hub__item-actions">
                <small class="status-hub__status ${order.status === 'done' ? 'is-done' : ''}">${escapeHtml(statusInfo.label)}</small>
                <a class="status-hub__link" href="status/?id=${order.id}">Hap</a>
              </div>
            </div>`;
        }).join('')}
        <div class="status-hub__footer">
            <button class="button button--primary status-hub__view-all-btn" data-action="view-all-status">SHIKO TË GJITHA</button>
        </div>
      </div>
    </div>
  `;
}

export function toggleHubDropdown() {
  document.querySelector('#hub-drop')?.classList.toggle('is-open');
}

/**
 * Shfaq një njoftim të përkohshëm (toast) në ekran.
 * @param {string} message - Mesazhi për t'u shfaqur.
 * @param {string} type - Tipi i njoftimit ('success' ose 'error').
 */
export function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast-notification is-${type}`;
  toast.textContent = message;
  
  document.body.appendChild(toast);

  // Fshije elementin pas animacionit
  setTimeout(() => {
    toast.remove();
  }, 3300); // Koha duhet të jetë pak më e gjatë se animacioni (3s + 0.3s)
}