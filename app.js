import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://uydjwcfzmsxikjftyngh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5ZGp3Y2Z6bXN4aWtqZnR5bmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMTc2NjgsImV4cCI6MjA4OTY5MzY2OH0.CfL1KYWcQ0mqzYEft9MOs2079ECYWCyakQKvtxscwX8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const params = new URLSearchParams(window.location.search);
const TABLE = parseInt(params.get('table')) || 1;
const tableLabel = document.getElementById('table-label');
if(tableLabel) tableLabel.textContent = `Tavolina ${TABLE}`;

let MENU = []; let CART = {}; let activeCat = 'all';
const CATS = { supat: 'Supa', senduic: 'Sanduiç', burger: 'Burgera', rizoto: 'Rizoto', sallata: 'Sallata', pasta: 'Pasta', pica: 'Pica', pule: 'Mish Pule', misherat: 'Mishërat', deti: 'Deti', desert: 'Desert' };

// --- LOGJIKA E STATUSIT (HUB) ---
async function syncStatus() {
    let ids = JSON.parse(localStorage.getItem('activeOrdersList') || "[]");
    if (ids.length === 0) {
        const hubContainer = document.getElementById('status-hub-container');
        if(hubContainer) hubContainer.innerHTML = '';
        return;
    }

    const dropEl = document.getElementById('hub-drop');
    const wasOpen = dropEl && dropEl.style.display === 'block';

    const { data: activeOrders, error } = await supabase
      .from('orders')
      .select('*')
      .in('id', ids)
      .or('status.eq.new,status.eq.preparing,status.eq.done');

    if (error || !activeOrders || activeOrders.length === 0) {
        const hubContainer = document.getElementById('status-hub-container');
        if(hubContainer) hubContainer.innerHTML = '';
        return;
    }

    const labels = { new: 'U dërgua', preparing: 'Në punë', done: 'Gati' };
    const hasDone = activeOrders.some(o => o.status === 'done');
    const chronological = [...activeOrders].reverse();

    const hubContainer = document.getElementById('status-hub-container');
    if(hubContainer) {
        hubContainer.innerHTML = `
            <div class="status-hub">
                <div class="hub-main">
                    <div class="hub-info">
                        <div class="hub-dot ${hasDone ? 'is-done' : ''}"></div>
                        <span><strong>${activeOrders.length} Porosi</strong> aktive</span>
                    </div>
                    <button class="hub-btn" onclick="window.toggleHub(event)">Shiko listën</button>
                </div>
                <div id="hub-drop" class="hub-dropdown" style="${wasOpen ? 'display:block;' : ''}">
                    ${chronological.map((o, index) => `
                        <div class="hub-item">
                            <span style="font-size: 13px; font-weight: 500;">Porosia #${o.id.toString().slice(-4)}</span>
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <small style="color: ${o.status === 'done' ? '#4CAF7D' : 'var(--muted)'}; font-size: 10px; text-transform: uppercase; font-weight: bold;">
                                    ${labels[o.status]}
                                </small>
                                <a href="status/?id=${o.id}" style="color: var(--accent-solid); text-decoration: none; font-size: 12px; font-weight: 700; background: rgba(255,255,255,0.05); padding: 5px 10px; border-radius: 8px; border:1px solid var(--border);">Hap</a>
                            </div>
                        </div>
                    `).join('')}
                    
                    <div style="text-align: center; padding: 15px 0 5px; border-top: 1px solid var(--border); margin-top: 5px;">
                        <button onclick="window.location.href='status/?all=true'" 
                                style="background: var(--accent-gradient); color: white; border: none; padding: 8px 16px; border-radius: 12px; font-size: 11px; cursor: pointer; font-weight:700; width: auto; min-width: 140px;">
                            SHIKO TË GJITHA
                        </button>
                    </div>
                </div>
            </div>`;
    }
}

window.toggleHub = (e) => {
    if(e) e.stopPropagation();
    const el = document.getElementById('hub-drop');
    if(el) {
        const isVisible = el.style.display === 'block';
        el.style.display = isVisible ? 'none' : 'block';
    }
};

// --- MENYJA DHE KATEGORITE ---
async function init() {
    try {
        const { data, error } = await supabase.from('menu').select('*').eq('active', true).order('category');
        if (error) throw error;
        if (data) { MENU = data; renderCats(); renderMenu(); }
        syncStatus();
    } catch (err) {
        console.error("Gabim:", err);
    }
}

function renderCats() {
    const list = [...new Set(MENU.map(i => i.category))];
    const bar = document.getElementById('cat-bar');
    if(bar) {
        bar.style.display = 'flex';
        bar.innerHTML = `<button class="cat-btn active" onclick="window.setCat('all', this)">Të gjitha</button>` +
            list.map(c => `<button class="cat-btn" onclick="window.setCat('${c}', this)">${CATS[c] || c}</button>`).join('');
    }
}

window.setCat = (c, btn) => {
    activeCat = c;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderMenu();
};

function renderMenu() {
    const filtered = activeCat === 'all' ? MENU : MENU.filter(i => i.category === activeCat);
    const groups = [...new Set(filtered.map(i => i.category))];
    const menuList = document.getElementById('menu-list');
    if(!menuList) return;

    menuList.innerHTML = groups.map(g => `
        <div class="section">
            <div class="section-title">${CATS[g] || g}</div>
            ${filtered.filter(i => i.category === g).map(item => `
                <div class="item-card">
                    <div class="item-image" style="background-image:url('${item.image || ''}')"></div>
                    <div class="item-info">
                        <div class="item-name">${item.name}</div>
                        <div class="item-desc">${item.description || ''}</div>
                        <div class="item-price">${parseFloat(item.price).toFixed(2)} €</div>
                    </div>
                    ${CART[item.id] ? `
                        <div class="qty-ctrl">
                            <button class="qty-btn" onclick="window.changeQty(${item.id},-1)">-</button>
                            <span>${CART[item.id]}</span>
                            <button class="qty-btn" onclick="window.changeQty(${item.id},1)">+</button>
                        </div>
                    ` : `<button class="add-btn" onclick="window.changeQty(${item.id},1)">+</button>`}
                </div>`).join('')}
        </div>`).join('');
}

// --- MENAXHIMI I SHPORTES (MODAL & BAR) ---
window.changeQty = (id, delta) => {
    CART[id] = (CART[id] || 0) + delta;
    if (CART[id] <= 0) delete CART[id];
    updateCartBar(); 
    renderMenu();
    if(document.getElementById('overlay').style.display === 'flex') renderModalContent();
};

window.removeItem = (id) => {
    delete CART[id];
    updateCartBar();
    renderMenu();
    if(document.getElementById('overlay').style.display === 'flex') {
        if(Object.keys(CART).length === 0) closeModal();
        else renderModalContent();
    }
};

function updateCartBar() {
    const items = Object.entries(CART);
    const count = items.reduce((s, [id, q]) => s + q, 0);
    const total = items.reduce((s, [id, q]) => {
        const item = MENU.find(i => i.id == id);
        return s + (item ? parseFloat(item.price) * q : 0);
    }, 0);
    
    const totalEl = document.getElementById('cart-total');
    if(totalEl) totalEl.textContent = total.toFixed(2) + ' €';
    
    const preview = document.getElementById('cart-preview');
    if(preview) {
        preview.innerHTML = items.map(([id, q]) => {
            const m = MENU.find(i => i.id == id);
            return m ? `
                <div class="preview-item">
                    <span style="flex:1; font-size: 14px;">${m.name}</span>
                    <div style="display:flex; align-items:center; gap:12px; background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:10px; border:1px solid var(--border); margin-right:10px;">
                        <button onclick="window.changeQty(${id},-1)" style="background:none; border:none; color:var(--accent-solid); font-size:16px; font-weight:800; cursor:pointer; padding:0 5px;">-</button>
                        <span style="font-weight:700; font-size:13px; min-width:15px; text-align:center;">${q}</span>
                        <button onclick="window.changeQty(${id},1)" style="background:none; border:none; color:var(--accent-solid); font-size:16px; font-weight:800; cursor:pointer; padding:0 5px;">+</button>
                    </div>
                    <span style="color: var(--muted); font-size: 13px; min-width: 50px; text-align: right;">${(parseFloat(m.price)*q).toFixed(2)} €</span>
                </div>` : '';
        }).join('');
    }
    
    const bar = document.getElementById('cart-bar');
    if(bar) bar.classList.toggle('visible', count > 0);
}

function renderModalContent() {
    const items = Object.entries(CART).map(([id, q]) => ({...MENU.find(i=>i.id==id), q}));
    const total = items.reduce((s, i) => s + (parseFloat(i.price)*i.q), 0);
    
    if (items.length === 0) { window.closeModal(); return; }

    // --- SHTIMI I SUGJERIMIT (UPSELLING) ---
    let sug = MENU.find(m => !CART[m.id] && m.category === 'desert') || MENU.find(m => !CART[m.id]);
    let upsellHTML = sug ? `
        <div style="margin-top: 15px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px dashed var(--border); display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 13px;">Provo edhe <b>${sug.name}</b> (+${sug.price}€)</div>
            <button onclick="window.changeQty(${sug.id}, 1)" style="background: var(--accent-solid); color: white; border: none; padding: 5px 10px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 11px;">Shto</button>
        </div>` : '';

    document.getElementById('modal-body').innerHTML = `
        <h2 style="font-family:'Playfair Display'; margin-bottom:20px; text-align:center;">Detajet e Porosisë</h2>
        <div style="max-height: 300px; overflow-y: auto;">
            ${items.map(i => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid var(--border);">
                    <div style="flex: 1;">
                        <div style="font-weight:600; font-size:14px;">${i.name}</div>
                        <div style="font-size:12px; color:var(--muted);">${(parseFloat(i.price)*i.q).toFixed(2)} €</div>
                    </div>
                    <div class="qty-ctrl">
                        <button class="qty-btn" onclick="window.changeQty(${i.id},-1)">-</button>
                        <span style="font-weight:700;">${i.q}</span>
                        <button class="qty-btn" onclick="window.changeQty(${i.id},1)">+</button>
                    </div>
                </div>
            `).join('')}
        </div>
        ${upsellHTML}
        <textarea id="note" style="width:100%; padding:15px; background:#111; border:1px solid var(--border); color:white; border-radius:15px; margin-top:15px; font-family:inherit;" placeholder="Shënim (p.sh. pa kripë, pa akull)..."></textarea>
        <button class="confirm-btn" id="send-btn" style="width:100%; background:var(--accent-gradient); border:none; padding:18px; border-radius:16px; color:white; font-weight:800; margin-top:20px; cursor:pointer;" onclick="window.sendOrder()">DËRGO POROSINË (${total.toFixed(2)} €)</button>`;
}

window.openModal = () => {
    renderModalContent();
    document.getElementById('overlay').style.display = 'flex';
};

window.closeModal = () => document.getElementById('overlay').style.display = 'none';

window.sendOrder = async () => {
    const btn = document.getElementById('send-btn');
    if(!btn) return;
    btn.disabled = true; btn.textContent = 'Duke dërguar...';
    
    const items = Object.entries(CART).map(([id, q]) => {
        const m = MENU.find(i => i.id == id);
        return { id: m.id, name: m.name, qty: q, price: parseFloat(m.price) };
    });

    const { data, error } = await supabase.from('orders').insert({
        table_number: TABLE, 
        items, 
        total: items.reduce((s,i)=>s+(i.price*i.qty),0),
        note: document.getElementById('note').value, 
        status: 'new'
    }).select().single();

    if (error) { 
        alert('Gabim gjatë dërgimit!'); 
        btn.disabled = false; 
        return; 
    }

    let list = JSON.parse(localStorage.getItem('activeOrdersList') || "[]");
    list.push(data.id);
    localStorage.setItem('activeOrdersList', JSON.stringify(list));
    
    CART = {}; 
    window.location.href = `status/?id=${data.id}`;
};

// --- LISTENERS PËR MBYLLJEN DHE EKZEKUTIMI ---

document.addEventListener('click', (e) => {
    const dropEl = document.getElementById('hub-drop');
    const hubContainer = document.querySelector('.status-hub');
    if(dropEl && dropEl.style.display === 'block' && hubContainer && !hubContainer.contains(e.target)) {
        dropEl.style.display = 'none';
    }
});

// --- FUNKSIONI PËR THIRRJEN E KAMARIERIT (MENU PAGE) ---
window.callWaiter = async () => {
    const btn = document.getElementById('waiter-btn');
    if(btn) { 
        btn.innerHTML = '⏳ Po vjen...'; 
        btn.disabled = true; 
    }

    await supabase.from('waiter_calls').insert({ 
        table_number: TABLE, 
        status: 'new' 
    });

    setTimeout(() => { 
        if(btn) { 
            btn.innerHTML = '🔔 Kamarieri'; 
            btn.disabled = false; 
        } 
    }, 60000);
};

(function injectWaiterBtn() {
    const btn = document.createElement('button');
    btn.id = 'waiter-btn';
    btn.innerHTML = '🔔 Kamarieri';
    btn.style.cssText = `
        position: fixed; 
        top: 66px; 
        right: 16px; 
        background: rgba(255,255,255,0.05); 
        border: 1px solid var(--border); 
        backdrop-filter: blur(15px); 
        color: white; 
        padding: 8px 16px; 
        border-radius: 20px; 
        font-size: 12px; 
        font-weight: 600; 
        cursor: pointer; 
        z-index: 1001; 
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        transition: 0.3s;
    `;
    btn.onclick = window.callWaiter;
    document.body.appendChild(btn);
})();

init();
setInterval(syncStatus, 10000);