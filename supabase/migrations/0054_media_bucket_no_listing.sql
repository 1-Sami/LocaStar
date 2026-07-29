-- The "media is publicly readable" policy grants SELECT on every row of
-- storage.objects for this bucket, which also lets any client LIST the bucket
-- and enumerate every file ever uploaded — including photos attached to
-- private activities and to hidden or removed content.
--
-- A public bucket does not need that policy to serve images: object URLs are
-- readable without it. Dropping it keeps every existing image URL working
-- while removing the ability to browse the bucket.
drop policy if exists "media is publicly readable" on storage.objects;
