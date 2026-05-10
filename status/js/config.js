export const CONFIG = {
    supabaseUrl: 'https://uydjwcfzmsxikjftyngh.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5ZGp3Y2Z6bXN4aWtqZnR5bmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMTc2NjgsImV4cCI6MjA4OTY5MzY2OH0.CfL1KYWcQ0mqzYEft9MOs2079ECYWCyakQKvtxscwX8',
    statusRefreshIntervalMs: 5000,
    waiterCooldownMs: 30000,
    activeOrdersStorageKey: 'active_orders',
    customerTokenStorageKey: 'customer_token',
    restaurantId: 1
};

export const STATUS_MESSAGES = {
    new: {
        normal: "Porosia juaj u dërgua me sukses dhe po shqyrtohet nga stafi.",
        busy: "Kuzhina është shumë e ngarkuar. Porosia juaj u dërgua dhe do të merret në konsideratë sa më shpejt të jetë e mundur."
    },
    preparing: {
        normal: "Kuzhina ka nisur përgatitjen e porosisë tuaj.",
        busy: "Kuzhina po punon me kapacitet maksimal. Faleminderit për durimin!"
    },
    done: {
        normal: "Porosia juaj është gati! Një nga stafi ynë po vjen ta sjellë në tavolinë.",
        busy: "Porosia juaj është gati! Stafi ynë po nxiton ta sjellë në tavolinën tuaj."
    }
};
