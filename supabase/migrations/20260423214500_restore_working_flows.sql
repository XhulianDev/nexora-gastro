-- Restore stable MVP flow after moving writes to Edge Functions.
-- Public users can read active menu.
-- Orders and waiter calls are created/read through customer-api/admin-api only.

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS customer_token TEXT;

ALTER TABLE public.waiter_calls
ADD COLUMN IF NOT EXISTS customer_token TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_customer_token ON public.orders (customer_token);
CREATE INDEX IF NOT EXISTS idx_waiter_calls_customer_token ON public.waiter_calls (customer_token);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created ON public.orders (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waiter_calls_restaurant_created ON public.waiter_calls (restaurant_id, created_at DESC);

ALTER TABLE public.menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiter_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view the menu" ON public.menu;
CREATE POLICY "Public can view the menu"
  ON public.menu FOR SELECT
  USING (active = true OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can create menu items" ON public.menu;
CREATE POLICY "Admins can create menu items"
  ON public.menu FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can update menu items" ON public.menu;
CREATE POLICY "Admins can update menu items"
  ON public.menu FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can delete menu items" ON public.menu;
CREATE POLICY "Admins can delete menu items"
  ON public.menu FOR DELETE
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Anyone can create an order" ON public.orders;
DROP POLICY IF EXISTS "Clients can read their own orders" ON public.orders;
DROP POLICY IF EXISTS "Clients can rate their completed orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can read all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;

CREATE POLICY "Admins can read all orders"
  ON public.orders FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins can update orders"
  ON public.orders FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can delete orders"
  ON public.orders FOR DELETE
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Anyone can create a waiter call" ON public.waiter_calls;
DROP POLICY IF EXISTS "Admins can read all waiter calls" ON public.waiter_calls;
DROP POLICY IF EXISTS "Admins can delete waiter calls" ON public.waiter_calls;
DROP POLICY IF EXISTS "Service role can create waiter calls" ON public.waiter_calls;

CREATE POLICY "Admins can read all waiter calls"
  ON public.waiter_calls FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins can delete waiter calls"
  ON public.waiter_calls FOR DELETE
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can create waiter calls"
  ON public.waiter_calls FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Public can view restaurants" ON public.restaurants;
CREATE POLICY "Public can view restaurants"
  ON public.restaurants FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage restaurants" ON public.restaurants;
CREATE POLICY "Admins can manage restaurants"
  ON public.restaurants FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
