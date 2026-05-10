import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getEnv } from './http.ts';

export type AdminRole = 'owner' | 'manager' | 'supervisor' | 'staff';

export type AdminContext = {
  userId: string;
  restaurantId: number;
  role: AdminRole;
};

export function createServiceClient() {
  return createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));
}

function getBearerToken(req: Request) {
  const header = req.headers.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

export async function requireAdmin(req: Request): Promise<{
  supabase: ReturnType<typeof createServiceClient>;
  admin: AdminContext;
}> {
  const supabase = createServiceClient();
  const token = getBearerToken(req);

  if (!token) throw new Error('Unauthorized');

  const { data: userRes, error: userError } = await supabase.auth.getUser(token);
  const user = userRes?.user;

  if (userError || !user) throw new Error('Unauthorized');

  const { data: adminUser, error } = await supabase
    .from('admin_users')
    .select('user_id, restaurant_id, role, active')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle();

  if (error) throw error;
  if (!adminUser) throw new Error('Forbidden');

  return {
    supabase,
    admin: {
      userId: String(adminUser.user_id),
      restaurantId: Number(adminUser.restaurant_id),
      role: String(adminUser.role || 'staff') as AdminRole,
    },
  };
}

export function assertAdminRole(admin: AdminContext, allowedRoles: AdminRole[]) {
  if (!allowedRoles.includes(admin.role)) throw new Error('Insufficient permissions');
}

export async function writeAuditLog(
  supabase: ReturnType<typeof createServiceClient>,
  admin: AdminContext,
  action: string,
  entityType: string,
  entityId: number | null,
  metadata: Record<string, unknown> = {},
) {
  try {
    await supabase.from('audit_logs').insert({
      restaurant_id: admin.restaurantId,
      admin_user_id: admin.userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    });
  } catch {
    // Audit logging must never block operational actions.
  }
}
