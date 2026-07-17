-- Daily, restaurant-scoped order references for customer-facing and staff-facing UI.
-- Technical orders.id remains the immutable primary key used by all APIs.

alter table public.orders
  add column if not exists business_date date,
  add column if not exists daily_number integer;

with ranked as (
  select
    id,
    (coalesce(created_at, now()) at time zone 'Europe/Belgrade')::date as resolved_business_date,
    row_number() over (
      partition by restaurant_id, (coalesce(created_at, now()) at time zone 'Europe/Belgrade')::date
      order by coalesce(created_at, now()), id
    )::integer as resolved_daily_number
  from public.orders
)
update public.orders as orders
set
  business_date = ranked.resolved_business_date,
  daily_number = ranked.resolved_daily_number
from ranked
where orders.id = ranked.id
  and (orders.business_date is null or orders.daily_number is null);

create unique index if not exists idx_orders_restaurant_business_daily_number
  on public.orders (restaurant_id, business_date, daily_number)
  where business_date is not null and daily_number is not null;

create table if not exists public.order_daily_counters (
  restaurant_id bigint not null,
  business_date date not null,
  last_number integer not null default 0 check (last_number >= 0),
  updated_at timestamptz not null default now(),
  primary key (restaurant_id, business_date)
);

insert into public.order_daily_counters (restaurant_id, business_date, last_number, updated_at)
select restaurant_id, business_date, max(daily_number), now()
from public.orders
where business_date is not null and daily_number is not null
group by restaurant_id, business_date
on conflict (restaurant_id, business_date)
do update set
  last_number = greatest(public.order_daily_counters.last_number, excluded.last_number),
  updated_at = now();

create or replace function public.assign_daily_order_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_business_date date;
  resolved_daily_number integer;
begin
  new.created_at := coalesce(new.created_at, now());
  resolved_business_date := (new.created_at at time zone 'Europe/Belgrade')::date;

  insert into public.order_daily_counters (restaurant_id, business_date, last_number, updated_at)
  values (new.restaurant_id, resolved_business_date, 1, now())
  on conflict (restaurant_id, business_date)
  do update set
    last_number = public.order_daily_counters.last_number + 1,
    updated_at = now()
  returning last_number into resolved_daily_number;

  new.business_date := resolved_business_date;
  new.daily_number := resolved_daily_number;
  return new;
end;
$$;

drop trigger if exists trg_assign_daily_order_number on public.orders;
create trigger trg_assign_daily_order_number
before insert on public.orders
for each row
execute function public.assign_daily_order_number();
