-- =============================================
-- 1. Tabela: menu
-- =============================================
ALTER TABLE public.menu ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view the menu" ON public.menu;
CREATE POLICY "Public can view the menu"
  ON public.menu FOR SELECT
  USING ( true );

DROP POLICY IF EXISTS "Admins can create menu items" ON public.menu;
CREATE POLICY "Admins can create menu items"
  ON public.menu FOR INSERT
  WITH CHECK ( auth.role() = 'service_role' );

DROP POLICY IF EXISTS "Admins can update menu items" ON public.menu;
CREATE POLICY "Admins can update menu items"
  ON public.menu FOR UPDATE
  USING ( auth.role() = 'service_role' )
  WITH CHECK ( auth.role() = 'service_role' );

DROP POLICY IF EXISTS "Admins can delete menu items" ON public.menu;
CREATE POLICY "Admins can delete menu items"
  ON public.menu FOR DELETE
  USING ( auth.role() = 'service_role' );

-- =============================================
-- 2. Tabela: orders
-- =============================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can create an order" ON public.orders;
CREATE POLICY "Anyone can create an order"
  ON public.orders FOR INSERT
  WITH CHECK ( true );

-- ADMIN RLS FOR ORDERS
DROP POLICY IF EXISTS "Admins can read all orders" ON public.orders;
CREATE POLICY "Admins can read all orders"
  ON public.orders FOR SELECT
  USING ( auth.role() = 'service_role' );

DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
CREATE POLICY "Admins can update orders"
  ON public.orders FOR UPDATE
  USING ( auth.role() = 'service_role' )
  WITH CHECK ( auth.role() = 'service_role' );

DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
CREATE POLICY "Admins can delete orders"
  ON public.orders FOR DELETE
  USING ( auth.role() = 'service_role' );

-- CLIENT RLS FOR ORDERS
DROP POLICY IF EXISTS "Clients can read their own orders" ON public.orders;
CREATE POLICY "Clients can read their own orders"
  ON public.orders FOR SELECT
  USING ( id = ANY(string_to_array(current_setting('request.headers', true)::json->>'x-order-ids', ',')::int[]) );

DROP POLICY IF EXISTS "Clients can rate their completed orders" ON public.orders;
CREATE POLICY "Clients can rate their completed orders"
  ON public.orders FOR UPDATE
  USING ( 
    status = 'done' AND
    id = ANY(string_to_array(current_setting('request.headers', true)::json->>'x-order-ids', ',')::int[])
  )
  WITH CHECK ( 
    auth.role() = 'anon' AND
    rating IN ('bad', 'ok', 'good')
  );

-- =============================================
-- 3. Tabela: waiter_calls
-- =============================================
ALTER TABLE public.waiter_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can create a waiter call" ON public.waiter_calls;
CREATE POLICY "Anyone can create a waiter call"
  ON public.waiter_calls FOR INSERT
  WITH CHECK ( true );

DROP POLICY IF EXISTS "Admins can read all waiter calls" ON public.waiter_calls;
CREATE POLICY "Admins can read all waiter calls"
  ON public.waiter_calls FOR SELECT
  USING ( auth.role() = 'service_role' );

DROP POLICY IF EXISTS "Admins can delete waiter calls" ON public.waiter_calls;
CREATE POLICY "Admins can delete waiter calls"
  ON public.waiter_calls FOR DELETE
  USING ( auth.role() = 'service_role' );

-- =============================================
-- 4. Tabela: restaurants
-- =============================================
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view restaurants" ON public.restaurants;
CREATE POLICY "Public can view restaurants"
  ON public.restaurants FOR SELECT
  USING ( true );

DROP POLICY IF EXISTS "Admins can manage restaurants" ON public.restaurants;
CREATE POLICY "Admins can manage restaurants"
  ON public.restaurants FOR ALL
  USING ( auth.role() = 'service_role' )
  WITH CHECK ( auth.role() = 'service_role' );
