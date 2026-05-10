-- Automatic device detection metadata for staff trusted devices.

alter table public.staff_devices
  add column if not exists device_type text,
  add column if not exists browser_name text,
  add column if not exists os_name text,
  add column if not exists user_agent text;

create index if not exists idx_staff_devices_type
on public.staff_devices (restaurant_id, device_type, status);
