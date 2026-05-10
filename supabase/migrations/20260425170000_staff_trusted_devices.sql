-- Staff access hardening: trusted devices, staff PIN hash, supervisor role.

-- Allow a limited supervisor role for operational security tasks.
alter table public.admin_users drop constraint if exists admin_users_role_check;
alter table public.admin_users
  add constraint admin_users_role_check
  check (role in ('owner', 'manager', 'supervisor', 'staff'));

create table if not exists public.staff_settings (
  restaurant_id bigint primary key default 1,
  pin_hash text,
  session_hours integer not null default 16 check (session_hours between 1 and 72),
  device_expiry_days integer not null default 30 check (device_expiry_days between 1 and 365),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_devices (
  id uuid primary key default gen_random_uuid(),
  restaurant_id bigint not null default 1,
  device_id text not null,
  label text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'revoked')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  expires_at timestamptz,
  last_seen_at timestamptz,
  session_token_hash text,
  session_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, device_id)
);

create index if not exists idx_staff_devices_restaurant_status
on public.staff_devices (restaurant_id, status, created_at desc);

create index if not exists idx_staff_devices_session
on public.staff_devices (restaurant_id, device_id, session_token_hash)
where status = 'approved';

alter table public.staff_settings enable row level security;
alter table public.staff_devices enable row level security;

drop policy if exists "Service role can manage staff settings" on public.staff_settings;
create policy "Service role can manage staff settings"
on public.staff_settings
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Service role can manage staff devices" on public.staff_devices;
create policy "Service role can manage staff devices"
on public.staff_devices
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
