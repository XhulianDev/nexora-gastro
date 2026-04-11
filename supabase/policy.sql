-- =============================================
-- 1. Tabela: menu
--    - Klientët: Mund ta lexojnë (SELECT).
--    - Admin: Mund të bëjë gjithçka (CRUD).
-- =============================================

-- 1.1 Aktivizo RLS për tabelën 'menu'
ALTER TABLE public.menu ENABLE ROW LEVEL SECURITY;

-- 1.2 Politika për LEXITIM (SELECT)
DROP POLICY IF EXISTS "Public can view the menu" ON public.menu;
CREATE POLICY "Public can view the menu"
  ON public.menu FOR SELECT
  USING ( true );

-- 1.3 Politika për KRIJIM (INSERT)
DROP POLICY IF EXISTS "Admins can create menu items" ON public.menu;
CREATE POLICY "Admins can create menu items"
  ON public.menu FOR INSERT
  WITH CHECK ( auth.role() = 'service_role' );

-- 1.4 Politika për PËRDITËSIM (UPDATE)
DROP POLICY IF EXISTS "Admins can update menu items" ON public.menu;
CREATE POLICY "Admins can update menu items"
  ON public.menu FOR UPDATE
  USING ( auth.role() = 'service_role' )
  WITH CHECK ( auth.role() = 'service_role' );

-- 1.5 Politika për FSHIRJE (DELETE)
DROP POLICY IF EXISTS "Admins can delete menu items" ON public.menu;
CREATE POLICY "Admins can delete menu items"
  ON public.menu FOR DELETE
  USING ( auth.role() = 'service_role' );

-- =============================================
-- 2. Tabela: orders
--    - Klientët: Krijojnë, lexojnë të tyret, vlerësojnë.
--    - Admin: CRUD i plotë.
-- =============================================

-- 2.1 Aktivizo RLS për tabelën 'orders'
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 2.2 Politika për KRIJIM (INSERT)
DROP POLICY IF EXISTS "Anyone can create an order" ON public.orders;
CREATE POLICY "Anyone can create an order"
  ON public.orders FOR INSERT
  WITH CHECK ( true );

-- 2.3 Politika për LEXIM (SELECT) nga Admin
DROP POLICY IF EXISTS "Admins can read all orders" ON public.orders;
CREATE POLICY "Admins can read all orders"
  ON public.orders FOR SELECT
  USING ( auth.role() = 'service_role' );

-- 2.4 Politika për PËRDITËSIM (UPDATE) nga Admin
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
CREATE POLICY "Admins can update orders"
  ON public.orders FOR UPDATE
  USING ( auth.role() = 'service_role' )
  WITH CHECK ( auth.role() = 'service_role' );

-- 2.5 Politika për FSHIRJE (DELETE) nga Admin
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
CREATE POLICY "Admins can delete orders"
  ON public.orders FOR DELETE
  USING ( auth.role() = 'service_role' );

-- 2.6 Politika për LEXIMIN E POROSIVE NGA KLIENTI
DROP POLICY IF EXISTS "Clients can read their own orders" ON public.orders;
CREATE POLICY "Clients can read their own orders"
  ON public.orders FOR SELECT
  USING ( id = ANY(string_to_array(current_setting('request.headers', true)::json->>'x-order-ids', ',')::int[]) );


-- 2.7 Politika për VLERËSIM (RATING) NGA KLIENTI
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
--    - Klientët: Mund të krijojnë një thirrje.
--    - Admin: Mund t'i lexojë dhe fshijë.
-- =============================================

-- 3.1 Aktivizo RLS për tabelën 'waiter_calls'
ALTER TABLE public.waiter_calls ENABLE ROW LEVEL SECURITY;

-- 3.2 Politika për KRIJIM (INSERT)
DROP POLICY IF EXISTS "Anyone can create a waiter call" ON public.waiter_calls;
CREATE POLICY "Anyone can create a waiter call"
  ON public.waiter_calls FOR INSERT
  WITH CHECK ( true );

-- 3.3 Politika për LEXIM (SELECT)
DROP POLICY IF EXISTS "Admins can read all waiter calls" ON public.waiter_calls;
CREATE POLICY "Admins can read all waiter calls"
  ON public.waiter_calls FOR SELECT
  USING ( auth.role() = 'service_role' );

-- 3.4 Politika për FSHIRJE (DELETE)
DROP POLICY IF EXISTS "Admins can delete waiter calls" ON public.waiter_calls;
CREATE POLICY "Admins can delete waiter calls"
  ON public.waiter_calls FOR DELETE
  USING ( auth.role() = 'service_role' );

-- =============================================
-- 4. Tabela: restaurants
--    - Klientët: Mund ta lexojnë.
--    - Admin: Mund të bëjë gjithçka (CRUD).
-- =============================================

-- 4.1 Aktivizo RLS për tabelën 'restaurants'
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

-- 4.2 Politika për LEXIM (SELECT)
DROP POLICY IF EXISTS "Public can view restaurants" ON public.restaurants;
CREATE POLICY "Public can view restaurants"
  ON public.restaurants FOR SELECT
  USING ( true );

-- 4.3 Politikat për menaxhim nga Admin (INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Admins can manage restaurants" ON public.restaurants;
CREATE POLICY "Admins can manage restaurants"
  ON public.restaurants FOR ALL
  USING ( auth.role() = 'service_role' )
  WITH CHECK ( auth.role() = 'service_role' );
