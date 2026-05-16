-- Run this once in the Supabase SQL editor to set up the clinic-logos storage bucket.
-- Dashboard → Storage → New bucket → Name: clinic-logos, Public: true
-- OR run the following SQL:

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clinic-logos',
  'clinic-logos',
  true,                          -- Public read
  2097152,                       -- 2 MB limit
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow anonymous uploads (registration wizard runs before auth is set up).
-- Once Phase 5 (Settings) is built, tighten this to authenticated users only.
CREATE POLICY "Public upload for onboarding" ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'clinic-logos');

CREATE POLICY "Public read for clinic logos" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'clinic-logos');
