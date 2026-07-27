import { ACTIONS } from './constants.js';
import { state } from './state.js';
import { fetchActiveMenu } from './api.js';
import * as ui from './ui.js';

document.addEventListener('DOMContentLoaded', bootstrap);

async function bootstrap() {
  document.addEventListener('click', handleClicks);
  await initMenu();
}

function handleClicks(event) {
  const categoryButton = event.target.closest('[data-category]');
  if (!categoryButton) return;

  state.activeCategory = categoryButton.dataset.category;
  ui.renderCategories();
  ui.renderMenu();

  const categoryBar = document.querySelector('#cat-bar');
  const activeButton = categoryBar?.querySelector('.category-btn.active');
  activeButton?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });

  const targetTop = document.querySelector('#menu-list')?.getBoundingClientRect().top + window.scrollY - (categoryBar?.offsetHeight || 0) - 14;
  if (Number.isFinite(targetTop)) window.scrollTo({ top: targetTop, behavior: 'smooth' });
}

async function initMenu() {
  ui.renderMenuLoading();

  try {
    state.menu = await fetchActiveMenu();
    ui.renderCategories();
    ui.renderMenu();
  } catch (error) {
    console.error('Gabim gjatë ngarkimit të menysë:', error);
    state.menu = [];
    ui.renderCategories();
    ui.renderMenuError();
  }
}

export { ACTIONS };
