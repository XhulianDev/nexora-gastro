import { SELECTORS } from './constants.js';

export const state = {
  menu: [],
  cart: {},
  activeCategory: 'all',
  tableNumber: 1
};

export const elements = {
  categoryBar: document.querySelector(SELECTORS.categoryBar),
  menuList: document.querySelector(SELECTORS.menuList)
};

export function findMenuItemById(itemId) {
  return state.menu.find((item) => String(item.id) === String(itemId)) || null;
}

export function getUpsellSuggestion() { return null; }
