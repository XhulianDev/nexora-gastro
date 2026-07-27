import { CATEGORY_DESCRIPTIONS, CATEGORY_LABELS, CATEGORY_ORDER } from './constants.js';
import { escapeHtml, formatMoney } from './utils.js';
import { state, elements } from './state.js';

const MENU_IMAGE_BY_NAME = Object.freeze({
  'brusketa domate mocarella': 'client/assets/menu/brusketa-domate-mocarella.webp',
  'brusketa domate mozzarella': 'client/assets/menu/brusketa-domate-mocarella.webp',
  'brusketa kikiriku': 'client/assets/menu/brusketa-kikiriku.webp',
  'brusketa salmon i tymosur': 'client/assets/menu/brusketa-salmon.webp',
  'brusketa salmon tymosur': 'client/assets/menu/brusketa-salmon.webp',
  'supe peshku': 'client/assets/menu/supe-peshku.webp',
  'sallate fshati greke shope': 'client/assets/menu/sallate-fshati-greke-shope.webp',
  'sallate cezar': 'client/assets/menu/sallate-cezar.webp'
});

function normalizeMenuName(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getMenuItemImage(item) {
  const suppliedImage = String(item?.image || '').trim();
  if (suppliedImage) return suppliedImage;

  const normalizedName = normalizeMenuName(item?.name);
  const exactMatch = MENU_IMAGE_BY_NAME[normalizedName];
  if (exactMatch) return exactMatch;

  // Emri në databazë mund të përmbajë fjalë si “me”, “dhe” ose simbolin “&”.
  // Për këtë arsye, fotoja e brusketës lidhet edhe sipas përbërësve kryesorë.
  const isTomatoMozzarellaBruschetta =
    normalizedName.includes('brusket') &&
    normalizedName.includes('domate') &&
    (normalizedName.includes('mocarella') || normalizedName.includes('mozzarella'));

  if (isTomatoMozzarellaBruschetta) {
    return 'client/assets/menu/brusketa-domate-mocarella.webp';
  }


  const isPeanutBruschetta =
    normalizedName.includes('brusket') &&
    normalizedName.includes('kikirik');

  if (isPeanutBruschetta) {
    return 'client/assets/menu/brusketa-kikiriku.webp';
  }

  const isSmokedSalmonBruschetta =
    normalizedName.includes('brusket') &&
    normalizedName.includes('salmon') &&
    normalizedName.includes('tymos');

  if (isSmokedSalmonBruschetta) {
    return 'client/assets/menu/brusketa-salmon.webp';
  }

  const isVillageSalad =
    normalizedName.includes('sallat') &&
    normalizedName.includes('fshati');

  if (isVillageSalad) {
    return 'client/assets/menu/sallate-fshati-greke-shope.webp';
  }

  const isCaesarSalad =
    normalizedName.includes('sallat') &&
    normalizedName.includes('cezar');

  if (isCaesarSalad) {
    return 'client/assets/menu/sallate-cezar.webp';
  }

  return '';
}

function sortCategories(categories = []) {
  const order = new Map(CATEGORY_ORDER.map((category, index) => [category, index]));
  return [...categories].sort((a, b) => {
    const aIndex = order.has(a) ? order.get(a) : Number.MAX_SAFE_INTEGER;
    const bIndex = order.has(b) ? order.get(b) : Number.MAX_SAFE_INTEGER;
    return aIndex - bIndex || String(a).localeCompare(String(b), 'sq');
  });
}

export function renderCategories() {
  if (!elements.categoryBar) return;

  const categoryList = sortCategories(new Set(state.menu.map((item) => item.category).filter(Boolean)));
  if (!categoryList.length) {
    elements.categoryBar.hidden = true;
    return;
  }

  elements.categoryBar.hidden = false;
  elements.categoryBar.innerHTML = [
    renderCategoryButton('all', 'Të gjitha', state.activeCategory === 'all'),
    ...categoryList.map((category) => renderCategoryButton(
      category,
      CATEGORY_LABELS[category] || category,
      state.activeCategory === category
    ))
  ].join('');
}

function renderCategoryButton(category, label, isActive) {
  return `
    <button type="button" class="category-btn ${isActive ? 'active' : ''}" data-category="${escapeHtml(category)}">
      ${escapeHtml(label)}
    </button>`;
}

export function renderMenuLoading() {
  if (!elements.menuList) return;
  elements.menuList.innerHTML = `
    <section class="menu-state">
      <span class="menu-state__mark">Casa Mia</span>
      <h2>Duke ngarkuar menynë…</h2>
      <div class="menu-skeleton" aria-hidden="true"><i></i><i></i><i></i></div>
    </section>`;
}

export function renderMenuError() {
  if (!elements.menuList) return;
  elements.menuList.innerHTML = `
    <section class="menu-state menu-state--error" role="alert">
      <span class="menu-state__mark">Njoftim</span>
      <h2>Menyja nuk u ngarkua.</h2>
      <p>Ju lutemi rifreskoni faqen ose kontaktoni stafin.</p>
      <button class="retry-button" type="button" onclick="window.location.reload()">Provo përsëri</button>
    </section>`;
}

export function renderEmptyMenu() {
  if (!elements.menuList) return;
  elements.menuList.innerHTML = `
    <section class="menu-state">
      <span class="menu-state__mark">Casa Mia</span>
      <h2>Nuk ka artikuj aktivë për momentin.</h2>
    </section>`;
}

export function renderMenu() {
  if (!elements.menuList) return;
  if (!state.menu.length) return renderEmptyMenu();

  const filteredMenu = state.activeCategory === 'all'
    ? state.menu
    : state.menu.filter((item) => item.category === state.activeCategory);

  if (!filteredMenu.length) return renderEmptyMenu();

  const categoriesInView = sortCategories(new Set(filteredMenu.map((item) => item.category).filter(Boolean)));

  elements.menuList.innerHTML = categoriesInView.map((category) => `
    <section class="menu-section reveal" id="category-${escapeHtml(category)}">
      <header class="menu-section__header">
        <h2>${escapeHtml(CATEGORY_LABELS[category] || category)}</h2>
        ${CATEGORY_DESCRIPTIONS[category] ? `<p>${escapeHtml(CATEGORY_DESCRIPTIONS[category])}</p>` : ''}
      </header>
      <div class="items-list">
        ${filteredMenu
          .filter((item) => item.category === category)
          .sort((a, b) => Number(a.id) - Number(b.id))
          .map(renderMenuItem)
          .join('')}
      </div>
    </section>`).join('');

  requestAnimationFrame(() => observeRenderedSections());
}

function observeRenderedSections() {
  const sections = elements.menuList.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    sections.forEach((section) => section.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      currentObserver.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -36px' });

  sections.forEach((section) => observer.observe(section));
}

function renderMenuItem(item) {
  const image = getMenuItemImage(item);
  const hasImage = Boolean(image);

  return `
    <article class="menu-item ${hasImage ? 'menu-item--featured' : ''}">
      ${hasImage ? `
        <div class="menu-item__media">
          <img
            src="${escapeHtml(image)}"
            alt="${escapeHtml(item.name || 'Artikull i menysë')}"
            width="800"
            height="600"
            loading="lazy"
            decoding="async"
          />
        </div>` : ''}
      <div class="menu-item__body">
        <div class="menu-item__heading">
          <div class="menu-item__copy">
            <h3>${escapeHtml(item.name || '')}</h3>
          </div>
          <span class="menu-item__leader" aria-hidden="true"></span>
          <strong class="menu-item__price">${formatMoney(item.price)}</strong>
        </div>
        <div class="menu-item__copy">
          ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
        </div>
      </div>
    </article>`;
}
