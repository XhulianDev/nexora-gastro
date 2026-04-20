
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

console.log("Initializing function...");

Deno.serve(async (req) => {
  // Handle CORS preflight requests for both POST and DELETE
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const projectUrl = Deno.env.get('PROJECT_URL');
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY');

    if (!projectUrl || !serviceRoleKey) {
      throw new Error("DIAGNOSTIC: Secrets PROJECT_URL or SERVICE_ROLE_KEY are not set.");
    }

    const supabaseAdmin = createClient(projectUrl, serviceRoleKey);

    // --- UPLOAD LOGIC (POST Request) ---
    if (req.method === 'POST') {
      const imageBlob = await req.blob();
      const fileName = req.headers.get('x-file-name') || `image-${Date.now()}.jpg`;
      
      const { data, error } = await supabaseAdmin.storage
        .from('menu-images')
        .upload(fileName, imageBlob, {
          cacheControl: '3600',
          upsert: true, // Overwrite file with the same name
        });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, path: data.path }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // --- DELETE LOGIC (DELETE Request) ---
    if (req.method === 'DELETE') {
      const { filePath } = await req.json();
      if (!filePath) throw new Error("File path is required for deletion.");

      const { error } = await supabaseAdmin.storage
        .from('menu-images')
        .remove([filePath]); // .remove() expects an array of paths

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, message: "File deleted successfully" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Handle other methods
    return new Response(JSON.stringify({ error: `Method ${req.method} Not Allowed` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: `Function failed: ${err.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});