-- Allow staff sessions to be configured with hours + minutes.
alter table public.staff_settings
  add column if not exists session_minutes integer not null default 0;

alter table public.staff_settings
  drop constraint if exists staff_settings_session_hours_check;

alter table public.staff_settings
  drop constraint if exists staff_settings_session_minutes_check;

alter table public.staff_settings
  add constraint staff_settings_session_hours_check
  check (session_hours between 0 and 72);

alter table public.staff_settings
  add constraint staff_settings_session_minutes_check
  check (session_minutes between 0 and 59);
