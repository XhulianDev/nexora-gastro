
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const API_URL = 'https://uydjwcfzmsxikjftyngh.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5ZGp3Y2Z6bXN4aWtqZnR5bmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMTc2NjgsImV4cCI6MjA4OTY5MzY2OH0.CfL1KYWcQ0mqzYEft9MOs2079ECYWCyakQKvtxscwX8';

// Exported for realtime listeners in app.js
export const supabase = createClient(API_URL, API_KEY);

async function getPublicUrl(path) {
    if (!path) return { publicUrl: null };
    const { data } = supabase.storage.from('menu-images').getPublicUrl(path);
    return data;
}

async function uploadMenuImage(file) {
  try {
    const response = await fetch(`${API_URL}/functions/v1/upload-menu-image`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'x-file-name': file.name },
      body: file
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Server responded with ${response.status}`);
    }
    const result = await response.json();
    const { publicUrl } = await getPublicUrl(result.path);
    return publicUrl;
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
    const filePath = url.pathname.split('/menu-images/')[1];
    if (!filePath) throw new Error("Could not extract file path from URL.");

    const response = await fetch(`${API_URL}/functions/v1/upload-menu-image`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
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
      // Don't re-throw, just log it.
  }
}

async function getMenu(restaurantId) {
  return supabase.from('menu').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false });
}

async function deleteMenuItem(id) {
  return supabase.from('menu').delete().eq('id', id);
}

// Wrapper function that app.js expects
async function saveMenuItem(payload, editId) {
    if (editId) {
        return supabase.from('menu').update(payload).eq('id', editId).select();
    } else {
        return supabase.from('menu').insert([payload]).select();
    }
}

// Dummy functions to avoid breaking app.js
async function getOrders(restaurantId) { return supabase.from('orders').select('*').eq('restaurant_id', restaurantId); }
async function getCalls(restaurantId) { return supabase.from('calls').select('*').eq('restaurant_id', restaurantId); }
async function updateStatus(orderId, status) { return supabase.from('orders').update({ status }).eq('id', orderId); }


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