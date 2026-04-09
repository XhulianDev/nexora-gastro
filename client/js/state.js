import { getTableNumberFromQuery } from './utils.js';
import { SELECTORS } from './constants.js';

export const state = {
  menu: [],
  cart: {},
  activeCategory: 'all',
  tableNumber: getTableNumberFromQuery()
};

export const elements = {
  statusHubContainer: document.querySelector(SELECTORS.statusHubContainer),
  tableLabel: document.querySelector(SELECTORS.tableLabel),
  categoryBar: document.querySelector(SELECTORS.categoryBar),
  menuList: document.querySelector(SELECTORS.menuList),
  cartBar: document.querySelector(SELECTORS.cartBar),
  cartPreview: document.querySelector(SELECTORS.cartPreview),
  cartTotal: document.querySelector(SELECTORS.cartTotal),
  cartCount: document.querySelector(SELECTORS.cartCount),
  cartOpenButton: document.querySelector(SELECTORS.cartOpenButton),
  overlay: document.querySelector(SELECTORS.overlay),
  modalBody: document.querySelector(SELECTORS.modalBody)
};

export function findMenuItemById(itemId) {
  return state.menu.find((item) => String(item.id) === String(itemId)) || null;
}

/**
 * Helper: Merr një element random nga një Array
 */
function getRandomItem(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Inteligjenca e Upsell-it: Sugjeron produkte në mënyrë dinamike
 */
export function getUpsellSuggestion() {
  const cartItemIds = Object.keys(state.cart);
  
  // Rasti 1: Shporta është bosh. Nuk sugjerojmë desert direkt.
  if (cartItemIds.length === 0) return null;

  // Rasti 2: Shporta ka produkte. Sugjerojmë një DESERT që NUK është në shportë.
  const availableDesserts = state.menu.filter(item => 
    item.category === 'desert' && !state.cart[item.id]
  );

  // Nëse ka desertë të disponueshëm, zgjedhim një random
  if (availableDesserts.length > 0) {
    return getRandomItem(availableDesserts);
  }

  // Rasti 3: Nëse klienti i ka marrë të gjithë desertët (klient i mirë!), 
  // sugjerojmë diçka tjetër random që nuk është në shportë (p.sh. një pije).
  const otherItems = state.menu.filter(item => !state.cart[item.id]);
  return getRandomItem(otherItems);
}