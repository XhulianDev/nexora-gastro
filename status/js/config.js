export const CONFIG = {
  supabaseUrl: 'https://uydjwcfzmsxikjftyngh.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5ZGp3Y2Z6bXN4aWtqZnR5bmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMTc2NjgsImV4cCI6MjA4OTY5MzY2OH0.CfL1KYWcQ0mqzYEft9MOs2079ECYWCyakQKvtxscwX8',
  activeOrdersStorageKey: 'activeOrdersList',
  statusRefreshIntervalMs: 10000,
  waiterCooldownMs: 60000
};

export const STATUS_MESSAGES = {
  new: { normal: "U dërgua! Së shpejti në punë.", busy: "U dërgua! Në radhë..." },
  preparing: { normal: 'Duke u përgatitur...', busy: 'Duke u përgatitur...' },
  done: { normal: 'Gati! Ju bëftë mirë.', busy: 'Gati! Ju bëftë mirë.' }
};