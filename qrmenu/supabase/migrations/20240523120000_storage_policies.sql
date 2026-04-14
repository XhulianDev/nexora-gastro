-- Krijon nje politike per akses publik per te lexuar imazhet
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'images' );

-- Krijon nje politike qe lejon perdoruesit e kycur (authenticated) te ngarkojne, modifikojne, dhe fshijne imazhe
CREATE POLICY "Authenticated Write Access"
ON storage.objects FOR ALL
TO authenticated
WITH CHECK ( bucket_id = 'images' );
