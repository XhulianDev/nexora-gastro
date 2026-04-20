// api.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const URL = 'https://uydjwcfzmsxikjftyngh.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5ZGp3Y2Z6bXN4aWtqZnR5bmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMTc2NjgsImV4cCI6MjA4OTY5MzY2OH0.CfL1KYWcQ0mqzYEft9MOs2079ECYWCyakQKvtxscwX8';

export const supabase = createClient(URL, KEY);

export const api = {
  // POROSITË
  getOrders: (rid) => supabase.from('orders').select('*').eq('restaurant_id', rid).order('created_at', { ascending: false }),
  updateStatus: (id, status) => supabase.from('orders').update({ status }).eq('id', id),
  deleteOrder: (id) => supabase.from('orders').delete().eq('id', id),

  // MENYJA
  getMenu: (rid) => supabase.from('menu').select('*').eq('restaurant_id', rid).order('category'),
  saveMenuItem: (payload, id = null) => {
    return id 
      ? supabase.from('menu').update(payload).eq('id', id)
      : supabase.from('menu').insert(payload);
  },
  deleteMenuItem: (id) => supabase.from('menu').delete().eq('id', id),

  /**
   * Thërret një Edge Function për të ngarkuar imazhin në mënyrë të sigurt.
   * @param {File} imageFile - Skedari i imazhit për t'u ngarkuar.
   * @returns {Promise<string|null>} URL-ja publike e skedarit ose null nëse ka gabim.
   */
  uploadMenuImage: async (imageFile) => {
      try {
        // Thërret funksionin e ri 'upload-menu-image' në Supabase
        const { data, error } = await supabase.functions.invoke('upload-menu-image', {
          body: imageFile, // Dërgon skedarin e fotos
          headers: {
            'x-file-name': imageFile.name, // Dërgon emrin e skedarit
          },
        });

        if (error) {
          console.error('Gabim gjatë thirrjes së funksionit:', error.message);
          return null;
        }

        // Tani që fotoja u ngarkua nga funksioni, marrim URL-në e saj publike
        const { data: publicUrlData } = supabase.storage
          .from('menu-images')
          .getPublicUrl(data.path); // 'data.path' vjen nga përgjigja e funksionit
        
        return publicUrlData.publicUrl;

      } catch (e) {
        console.error('Gabim fatal gjatë ngarkimit të fotos:', e);
        return null;
      }
    },

  // THIRRJET E KAMARIERIT
  getCalls: (rid) => supabase.from('waiter_calls').select('*').eq('restaurant_id', rid),
  deleteCall: (id) => supabase.from('waiter_calls').delete().eq('id', id)
};