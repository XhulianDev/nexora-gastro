-- Sprint 5.1 — classify waiter calls by operational purpose.
alter table public.waiter_calls
  add column if not exists call_type text not null default 'help';

update public.waiter_calls
set call_type = 'help'
where call_type is null or call_type not in ('help', 'payment');

alter table public.waiter_calls
  drop constraint if exists waiter_calls_call_type_check;

alter table public.waiter_calls
  add constraint waiter_calls_call_type_check
  check (call_type in ('help', 'payment'));

create index if not exists idx_waiter_calls_active_by_type
on public.waiter_calls (restaurant_id, table_number, call_type, status, deleted_at, created_at desc);
