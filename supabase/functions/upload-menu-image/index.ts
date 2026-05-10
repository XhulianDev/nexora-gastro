import { corsHeaders } from '../_shared/cors.ts';
import { errorResponse, getEnv, json, readJson } from '../_shared/http.ts';
import { assertAdminRole, requireAdmin } from '../_shared/adminAuth.ts';

const BUCKET = 'menu-images';
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = req.method === 'DELETE' ? await readJson(req) : {};
    const { supabase, admin } = await requireAdmin(req);
    assertAdminRole(admin, ['owner', 'manager']);

    if (req.method === 'POST') {
      const imageBlob = await req.blob();
      const contentType = imageBlob.type || req.headers.get('content-type') || 'application/octet-stream';

      if (!ALLOWED_TYPES.has(contentType)) return errorResponse('Unsupported image type', 415);
      if (imageBlob.size > MAX_FILE_SIZE_BYTES) return errorResponse('Image is too large', 413);

      const originalName = req.headers.get('x-file-name') || `image-${Date.now()}.webp`;
      const fileName = `${admin.restaurantId}/${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(originalName)}`;

      const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, imageBlob, {
          cacheControl: '31536000',
          upsert: false,
          contentType,
        });

      if (error) throw error;

      const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
      return json({ success: true, path: data.path, publicUrl: publicData.publicUrl });
    }

    if (req.method === 'DELETE') {
      const filePath = String(body.filePath || '').trim();
      if (!filePath) return errorResponse('File path is required', 400);

      // Prevent admins from deleting images outside their restaurant folder.
      if (!filePath.startsWith(`${admin.restaurantId}/`)) {
        return errorResponse('Forbidden file path', 403);
      }

      const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
      if (error) throw error;
      return json({ success: true });
    }

    return errorResponse(`Method ${req.method} not allowed`, 405);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Unauthorized' ? 401 : 500;
    return errorResponse(message, status);
  }
});
