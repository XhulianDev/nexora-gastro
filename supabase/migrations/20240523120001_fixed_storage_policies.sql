-- STORAGE POLICIES

-- 1. Krijo bucket-in per fotot e menyse (nese nuk ekziston)
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Politika per shikim (SELECT)
-- Lejon kedo te shikoje imazhet.
DROP POLICY IF EXISTS "Allow public read access to menu images" ON storage.objects;
CREATE POLICY "Allow public read access to menu images"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'menu-images' );

-- 3. Politika per ngarkim (INSERT)
-- Lejon vetem admin-at te ngarkojne imazhe.
DROP POLICY IF EXISTS "Allow admin insert on menu images" ON storage.objects;
CREATE POLICY "Allow admin insert on menu images"
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'menu-images' AND auth.role() = 'service_role' );

-- 4. Politika per perditesim (UPDATE)
-- Lejon vetem admin-at te perditesojne imazhe.
DROP POLICY IF EXISTS "Allow admin update on menu images" ON storage.objects;
CREATE POLICY "Allow admin update on menu images"
  ON storage.objects FOR UPDATE
  USING ( bucket_id = 'menu-images' AND auth.role() = 'service_role' );

-- 5. Politika per fshirje (DELETE)
-- Lejon vetem admin-at te fshijne imazhe.
DROP POLICY IF EXISTS "Allow admin delete on menu images" ON storage.objects;
CREATE POLICY "Allow admin delete on menu images"
  ON storage.objects FOR DELETE
  USING ( bucket_id = 'menu-images' AND auth.role() = 'service_role' );