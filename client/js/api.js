import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { API } from './constants.js';

// Inicializimi i klientit Supabase
export const supabase = createClient(API.SUPABASE_URL, API.SUPABASE_KEY);

/**
 * Merr menunë aktive nga databaza
 */
export async function fetchActiveMenu() {
  const { data, error } = await supabase
    .from('menu')
    .select('*')
    .eq('active', true)
    .order('category');

  if (error) throw error;
  return data || [];
}

/**
 * Dërgon porosinë e re në tabelën 'orders'
 */
export async function submitOrder(tableNumber, items, total, note) {
  const { data, error } = await supabase
    .from('orders')
    .insert({ 
      table_number: tableNumber, 
      items, 
      total, 
      note, 
      status: 'new' 
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Merr porositë aktive bazuar në ID-të e ruajtura në LocalStorage
 */
export async function fetchActiveOrders(activeOrderIds) {
  if (!activeOrderIds || activeOrderIds.length === 0) return [];

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .in('id', activeOrderIds)
    // Marrim vetëm ato që nuk janë mbyllur ose anuluar
    .or('status.eq.new,status.eq.preparing,status.eq.done');

  if (error) throw error;
  return data || [];
}

/**
 * Dërgon një thirrje për kamarier
 */
export async function insertWaiterCall(tableNumber) {
  const { error } = await supabase
    .from('waiter_calls')
    .insert({ 
      table_number: tableNumber, 
      status: 'new' 
    });

  if (error) throw error;
}