-- Production hardening: real admin accounts, soft-delete, audit logs.

alter table public.menu add column if not exists deleted_at timestamptz;
alter table public.menu add column if not exists updated_at timestamptz default now();
alter table public.orders add column if not exists deleted_at timestamptz;
alter table public.orders add column if not exists updated_at timestamptz default now();
alter table public.waiter_calls add column if not exists deleted_at timestamptz;
alter table public.waiter_calls add column if not exists updated_at timestamptz default now();

create table if not exists public.admin_users (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_id bigint not null default 1,
  role text not null default 'staff' check (role in ('owner', 'manager', 'staff')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, restaurant_id)
);

create table if not exists public.audit_logs (
  id bigserial primary key,
  restaurant_id bigint not null default 1,
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_users_user_active on public.admin_users(user_id, active);
create index if not exists idx_admin_users_restaurant on public.admin_users(restaurant_id);
create index if not exists idx_audit_logs_restaurant_created on public.audit_logs(restaurant_id, created_at desc);
create index if not exists idx_menu_restaurant_not_deleted on public.menu(restaurant_id, deleted_at);
create index if not exists idx_orders_restaurant_not_deleted on public.orders(restaurant_id, deleted_at);
create index if not exists idx_waiter_calls_restaurant_not_deleted on public.waiter_calls(restaurant_id, deleted_at);

alter table public.admin_users enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "Admin users can read own admin row" on public.admin_users;
create policy "Admin users can read own admin row"
on public.admin_users
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Admin users can read own audit logs" on public.audit_logs;
create policy "Admin users can read own audit logs"
on public.audit_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
      and au.restaurant_id = audit_logs.restaurant_id
      and au.active = true
  )
);

-- IMPORTANT:
-- Create an admin in Supabase Dashboard > Authentication > Users.
-- Then connect it to restaurant 1 with:
-- insert into public.admin_users (user_id, restaurant_id, role)
-- values ('AUTH_USER_UUID_HERE', 1, 'owner');
