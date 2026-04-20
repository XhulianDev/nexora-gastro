import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ---- DIAGNOSTIC CHECK ----
    const projectUrl = Deno.env.get('PROJECT_URL');
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY');

    if (!projectUrl || !serviceRoleKey) {
      throw new Error("DIAGNOSTIC: Secrets PROJECT_URL or SERVICE_ROLE_KEY are not set in the function's environment.");
    }
    // ---- END DIAGNOSTIC CHECK ----

    const supabaseAdmin = createClient(projectUrl, serviceRoleKey);

    const imageBlob = await req.blob();
    const fileName = req.headers.get('x-file-name') || `image-${new Date().toISOString()}.jpg`;
    
    const { data, error } = await supabaseAdmin.storage
      .from('menu-images')
      .upload(fileName, imageBlob, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      // Re-throw the storage error to be caught by the catch block
      throw error;
    }

    return new Response(JSON.stringify({ success: true, path: data.path }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    // Return a more detailed error message
    return new Response(JSON.stringify({ 
      error: `Function failed: ${err.message}` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500, // Using 500 for server-side errors
    });
  }
});