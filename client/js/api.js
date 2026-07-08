import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { API } from './constants.js';
import { getOrCreateCustomerToken } from './utils.js';

const customerToken = getOrCreateCustomerToken();
const supabase = createClient(API.SUPABASE_URL, API.SUPABASE_KEY);

async function callCustomerApi(action, payload = {}) {
  const response = await fetch(`${API.SUPABASE_URL}/functions/v1/customer-api`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API.SUPABASE_KEY}`,
      apikey: API.SUPABASE_KEY,
      'Content-Type': 'application/json',
      'x-customer-token': customerToken,
    },
    body: JSON.stringify({ action, restaurantId: API.RESTAURANT_ID, ...payload }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || `Customer API failed with ${response.status}`);
  }

  return result;
}

export async function fetchActiveMenu() {
  try {
    const result = await callCustomerApi('getMenu');
    return result.data || [];
  } catch (apiError) {
    console.warn('customer-api menu failed, falling back to public menu select', apiError);
    const { data, error } = await supabase
      .from('menu')
      .select('*')
      .eq('active', true)
      .order('category', { ascending: true });

    if (error) throw error;
    return data || [];
  }
}

export async function submitOrder(table, items, note) {
  const result = await callCustomerApi('createOrder', { tableNumber: table, items, note });
  return result.data;
}

export async function fetchActiveOrders(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const result = await callCustomerApi('getOrders', { ids });
  return result.data || [];
}

export async function insertWaiterCall(table, callType = 'help') {
  const type = String(callType || 'help') === 'payment' ? 'payment' : 'help';
  const result = await callCustomerApi('callWaiter', { tableNumber: table, callType: type, call_type: type });
  return result;
}

export async function cancelWaiterCall(callId, table) {
  const result = await callCustomerApi('cancelWaiterCall', { id: callId, tableNumber: table });
  return result.data;
}

export async function fetchActiveWaiterCalls(table) {
  const result = await callCustomerApi('getActiveWaiterCalls', { tableNumber: table });
  return result.data || [];
}

export async function fetchActiveWaiterCall(table) {
  const result = await callCustomerApi('getActiveWaiterCall', { tableNumber: table });
  return result.data || null;
}
