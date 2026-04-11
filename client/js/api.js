import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { API } from './constants.js';

// Krijojmë një klient të vetëm, të konfiguruar dhe e eksportojmë atë
const supabase = createClient(API.SUPABASE_URL, API.SUPABASE_KEY);

export async function fetchActiveMenu() {
  const { data, error } = await supabase
    .from('menu')
    .select('*')
    .eq('active', true)
    .order('category', { ascending: true });

  if (error) throw error;
  return data;
}

export async function submitOrder(table, items, total, note) {
  const { data, error } = await supabase
    .from('orders')
    .insert({
      table_number: table,
      items: items,
      total: total,
      note: note,
      status: 'new'
    })
    .select()
    .single(); // Kjo kthen vetëm objektin e porosisë, jo një array

  if (error) throw error;
  return data;
}

export async function fetchActiveOrders(ids) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .in('id', ids)
    .in('status', ['new', 'preparing', 'done']);

  if (error) throw error;
  return data;
}

export async function insertWaiterCall(table) {
    const { error } = await supabase
        .from('waiter_calls')
        .insert({ table_number: table, status: 'new' });

    if (error) throw error;
    return true;
}