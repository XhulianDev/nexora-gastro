import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CONFIG } from './config.js';

export const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || '';
}

async function getAdminHeaders(extraHeaders = {}) {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('Nuk je i kyçur. Hyr përsëri.');
  return {
    Authorization: 'Bearer ' + accessToken,
    apikey: CONFIG.supabaseKey,
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
}

async function parseResponse(response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Request failed with ' + response.status);
  return result;
}

async function callAdminApi(action, payload = {}) {
  const response = await fetch(CONFIG.supabaseUrl + '/functions/v1/admin-api', {
    method: 'POST',
    headers: await getAdminHeaders(),
    body: JSON.stringify({ action, ...payload }),
  });
  return parseResponse(response);
}

async function uploadMenuImage(file) {
  const response = await fetch(CONFIG.supabaseUrl + '/functions/v1/upload-menu-image', {
    method: 'POST',
    headers: await getAdminHeaders({
      'Content-Type': file.type || 'application/octet-stream',
      'x-file-name': file.name,
    }),
    body: file,
  });
  const result = await parseResponse(response);
  return result.publicUrl;
}

function extractMenuImagePath(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return '';

  try {
    const url = new URL(imageUrl);
    const marker = '/menu-images/';
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return '';
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    const marker = '/menu-images/';
    const markerIndex = imageUrl.indexOf(marker);
    if (markerIndex === -1) return '';
    return decodeURIComponent(imageUrl.slice(markerIndex + marker.length));
  }
}

function isOwnMenuImagePath(filePath) {
  return Boolean(filePath && filePath.startsWith(`${CONFIG.restaurantId}/`));
}

async function deleteMenuImage(imageUrl) {
  const filePath = extractMenuImagePath(imageUrl);

  // Old/demo images sometimes exist as raw filenames or as storage paths
  // outside the current restaurant folder. Do not call the Edge Function for
  // those, because the backend will correctly reject them with 403.
  if (!isOwnMenuImagePath(filePath)) {
    return { success: true, skipped: true };
  }

  const response = await fetch(CONFIG.supabaseUrl + '/functions/v1/upload-menu-image', {
    method: 'DELETE',
    headers: await getAdminHeaders(),
    body: JSON.stringify({ filePath }),
  });

  return parseResponse(response);
}

async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
async function signOut() { await supabase.auth.signOut(); }
async function hasAuthSession() { const { data } = await supabase.auth.getSession(); return Boolean(data.session?.access_token); }
async function getCurrentAdmin() { return callAdminApi('getCurrentAdmin'); }
async function getMenu() { return callAdminApi('getMenu'); }
async function deleteMenuItem(id) { return callAdminApi('deleteMenuItem', { id }); }
async function saveMenuItem(payload, editId) { return callAdminApi('saveMenuItem', { payload, editId }); }
async function getOrders() { return callAdminApi('getOrders'); }
async function getCalls() { return callAdminApi('getCalls'); }
async function getArchive() { return callAdminApi('getArchive'); }
async function clearArchive() { return callAdminApi('clearArchive'); }
async function getZones() { return callAdminApi('getZones'); }
async function updateStatus(orderId, status) { return callAdminApi('updateStatus', { orderId, status }); }
async function deleteOrder(orderId) { return callAdminApi('deleteOrder', { id: orderId }); }
async function deleteCall(callId) { return callAdminApi('deleteWaiterCall', { id: callId }); }
async function acknowledgeCall(callId) { return callAdminApi('acknowledgeWaiterCall', { id: callId }); }
async function archiveDoneOrders(ids = []) { return callAdminApi('archiveDoneOrders', { ids }); }
async function archiveWaiterCalls(ids = []) { return callAdminApi('archiveWaiterCalls', { ids }); }
async function getStaffSettings() { return callAdminApi('getStaffSettings'); }
async function updateStaffPin({ pin, sessionHours, sessionMinutes, deviceExpiryDays }) { return callAdminApi('updateStaffPin', { pin, sessionHours, sessionMinutes, deviceExpiryDays }); }
async function getStaffDevices() { return callAdminApi('getStaffDevices'); }
async function approveStaffDevice(id) { return callAdminApi('approveStaffDevice', { id }); }
async function revokeStaffDevice(id) { return callAdminApi('revokeStaffDevice', { id }); }
async function deleteStaffDevice(id) { return callAdminApi('deleteStaffDevice', { id }); }

export const api = { signIn, signOut, hasAuthSession, getCurrentAdmin, uploadMenuImage, deleteMenuImage, getMenu, deleteMenuItem, saveMenuItem, getOrders, getCalls, getArchive, clearArchive, getZones, updateStatus, deleteOrder, deleteCall, getStaffSettings, updateStaffPin, getStaffDevices, approveStaffDevice, revokeStaffDevice, deleteStaffDevice, acknowledgeCall, archiveDoneOrders, archiveWaiterCalls };
