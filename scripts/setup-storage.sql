-- Run this once in the Supabase SQL editor to set up the clinic-logos storage bucket.
-- Dashboard → Storage → New bucket → Name: clinic-logos, Public: true
-- OR run the following SQL:

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clinic-logos',
  'clinic-logos',
  true,                          -- Public read: logo URLs work without a policy
  2097152,                       -- 2 MB limit
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- No storage.objects policies, on purpose. Logos are uploaded only by the
-- server (`/api/clinic/logo`, an authenticated admin) with the service role
-- key, which bypasses RLS. Signup no longer uploads anything from the browser,
-- so anonymous and signed-in browser uploads stay blocked.
