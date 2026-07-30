-- 0054 dropped the only SELECT policy on storage.objects to stop the media
-- bucket being enumerated. That closed the leak but also broke every upload:
-- the storage API inserts with a RETURNING clause, and Postgres applies SELECT
-- policies to RETURNING rows, so each upload failed with
-- "new row violates row-level security policy". No file uploaded after 0054.
--
-- Restore SELECT, but scoped to the uploader's own objects instead of the whole
-- bucket. Uploads can read back the row they just wrote, while nobody can list
-- anyone else's files. Public image URLs are unaffected either way — the bucket
-- is public, so those are served without consulting RLS at all.
create policy "users read their own uploaded media" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and owner = auth.uid());
