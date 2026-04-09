/**
 * URBAN BITE - Global Constants & Configuration
 * Ky skedar përmban të gjitha vlerat statike të aplikacionit.
 */

// 1. Konfigurimi i Shërbimeve (API & Infrastructure)
export const API = Object.freeze({
  SUPABASE_URL: 'https://uydjwcfzmsxikjftyngh.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5ZGp3Y2Z6bXN4aWtqZnR5bmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMTc2NjgsImV4cCI6MjA4OTY5MzY2OH0.CfL1KYWcQ0mqzYEft9MOs2079ECYWCyakQKvtxscwX8',
  REFRESH_INTERVAL: 10000, // 10 sekonda
  WAITER_COOLDOWN: 60000    // 1 minutë
});

// 2. Menaxhimi i të Dhënave Lokale (Persistence)
export const STORAGE = Object.freeze({
  ACTIVE_ORDERS: 'activeOrdersList',
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
  waiterButton: '#waiter-btn'
});