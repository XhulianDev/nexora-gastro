/**
 * NEXORA GASTRO - Global Constants & Configuration
 * Ky skedar përmban të gjitha vlerat statike të aplikacionit.
 */

// 1. Konfigurimi i Shërbimeve (API & Infrastructure)
export const API = Object.freeze({
  SUPABASE_URL: 'https://uydjwcfzmsxikjftyngh.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5ZGp3Y2Z6bXN4aWtqZnR5bmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMTc2NjgsImV4cCI6MjA4OTY5MzY2OH0.CfL1KYWcQ0mqzYEft9MOs2079ECYWCyakQKvtxscwX8',
  REFRESH_INTERVAL: 3000,
  WAITER_COOLDOWN: 60000,
  WAITER_MAX_CALLS_PER_WINDOW: 2,
  ORDER_NOTE_MAX_LENGTH: 120,
  RESTAURANT_ID: 1
});

// 2. Menaxhimi i të Dhënave Lokale (Persistence)
export const STORAGE = Object.freeze({
  ACTIVE_ORDERS: 'nexora_gastro_active_orders',
  CUSTOMER_TOKEN: 'nexora_gastro_customer_token',
  ACTIVE_WAITER_CALLS: 'nexora_gastro_active_waiter_calls',
  DEFAULT_TABLE: 1
});

// 3. Etiketat e Sistemit (Domain Labels)
export const CATEGORY_LABELS = Object.freeze({
  supat: 'Supa',
  senduic: 'Sanduiç',
  burger: 'Burgera',
  rizoto: 'Rizoto',
  sallata: 'Sallata',
  pasta: 'Pasta',
  pica: 'Pica',
  pule: 'Mish Pule',
  misherat: 'Mishërat',
  deti: 'Deti',
  desert: 'Desert'
});

export const ORDER_STATUS = Object.freeze({
  NEW: { id: 'new', label: 'U dërgua' },
  PREPARING: { id: 'preparing', label: 'Në punë' },
  DONE: { id: 'done', label: 'Gati' }
});

// 4. Mesazhet e Statusit (UI Feedback)
export const STATUS_MESSAGES = Object.freeze({
  new: {
    normal: "U dërgua! Së shpejti në punë.",
    busy: "U dërgua! Në radhë për t'u përgatitur."
  },
  preparing: {
    normal: 'Duke u përgatitur...',
    busy: 'Duke u përgatitur...'
  },
  done: {
    normal: 'Gati! Ju bëftë mirë.',
    busy: 'Gati! Ju bëftë mirë.'
  }
});

// 5. Selektorët e DOM (DOM Mapping)
export const SELECTORS = Object.freeze({
  statusHubContainer: '#status-hub-container',
  tableLabel: '#table-label',
  categoryBar: '#cat-bar',
  menuList: '#menu-list',
  cartBar: '#cart-bar',
  cartPreview: '#cart-preview',
  cartTotal: '#cart-total',
  cartCount: '#cart-count',
  cartOpenButton: '#cart-open-btn',
  overlay: '#overlay',
  modalBody: '#modal-body',
  mainContent: '#main-content',
  backButton: '#btn-back',
  waiterButton: '#waiter-btn',
  waiterActionButtons: '[data-action="call-waiter"]'
});

// 6. Veprimet e Përdoruesit (User Actions)
export const ACTIONS = Object.freeze({
  VIEW_CATEGORY: 'view-category',
  CHANGE_QTY: 'change-qty',
  UPSELL_ADD: 'upsell-add',
  SEND_ORDER: 'send-order',
  TOGGLE_HUB: 'toggle-hub',
  VIEW_ALL_STATUS: 'view-all-status',
  RETRY_MENU: 'retry-menu',
  CALL_WAITER: 'call-waiter',
  TOGGLE_WAITER_MENU: 'toggle-waiter-menu'
});
