
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CONFIG } from './config.js';

// ===================================================================================
// ZGJIDHJA DEFINITIVE: DY KLIENTË TË PAKONFLIKTUESHËM
// ===================================================================================
// Kjo është zgjidhja përfundimtare që adreson të gjitha problemet e hasura.
//
// 1. KLIENTI REALTIME (PUBLIK):
//    Ky klient përdor çelësin publik (anon key) dhe është PËR VETËM një qëllim:
//    të menaxhojë lidhjen "live" (WebSocket). Kjo i lejon të përdorë politikat
//    RLS që kemi vendosur, të cilat i japin rolit 'anon' leje për të dëgjuar.
//
export const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

// 2. KLIENTI I ADMINIT (SEKRET):
//    Ky klient përdor çelësin e plotfuqishëm të shërbimit (service_role).
//    Opsioni thelbësor `persistSession: false` e instrukton këtë klient të MOS
//    përdorë localStorage, duke parandaluar kështu konfliktin dhe gabimin
//    "Multiple GoTrueClient instances". Ky klient do të përdoret për të gjitha
//    veprimet me të dhëna (GET, POST, UPDATE, DELETE).
//
const adminClient = createClient(CONFIG.supabaseUrl, CONFIG.adminSecret, {
    auth: {
        persistSession: false
    }
});

// 3. FUNKSIONET E API-t
//    Çdo funksion që ndërvepron me databazën do të përdorë klientin e duhur.
//    Thirrjet e funksioneve (Edge Functions) dhe veprimet me të dhëna do të
//    përdorin klientin e sigurt të adminit.
//
async function uploadMenuImage(file) {
  try {
    const response = await fetch(`${CONFIG.supabaseUrl}/functions/v1/upload-menu-image`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${CONFIG.supabaseKey}`, 'x-file-name': file.name },
      body: file
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Server responded with ${response.status}`);
    }
    const result = await response.json();
    return result.publicUrl;
  } catch (error) {
    console.error('Gabim gjatë ngarkimit të fotos:', error);
    throw error;
  }
}

async function deleteMenuImage(imageUrl) {
  if (!imageUrl || !imageUrl.includes('/menu-images/')) {
      console.warn('Invalid image URL for deletion:', imageUrl);
      return;
  }
  try {
    const url = new URL(imageUrl);
    const filePath = url.pathname.split('/storage/v1/object/public/menu-images/')[1];
    if (!filePath) throw new Error("Could not extract file path from URL.");

    const response = await fetch(`${CONFIG.supabaseUrl}/functions/v1/upload-menu-image`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${CONFIG.supabaseKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: filePath })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server responded with ${response.status}`);
    }
    console.log('Image deleted successfully via function.');
    return await response.json();
  } catch (error) {
      console.error('Gabim gjatë fshirjes së fotos:', error);
  }
}

// Të gjitha funksionet e mëposhtme tani përdorin `adminClient`
async function getMenu(restaurantId) {
  return adminClient.from('menu').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false });
}

async function deleteMenuItem(id) {
  return adminClient.from('menu').delete().eq('id', id);
}

async function saveMenuItem(payload, editId) {
    if (editId) {
        return adminClient.from('menu').update(payload).eq('id', editId).select();
    } else {
        return adminClient.from('menu').insert([payload]).select();
    }
}

async function getOrders(restaurantId) {
  return adminClient.from('orders').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false });
}

async function getCalls(restaurantId) {
  return adminClient.from('waiter_calls').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false });
}

async function updateStatus(orderId, status) {
  return adminClient.from('orders').update({ status }).eq('id', orderId);
}

export const api = {
    uploadMenuImage,
    deleteMenuImage,
    getMenu,
    deleteMenuItem,
    saveMenuItem,
    getOrders,
    getCalls,
    updateStatus,
};
