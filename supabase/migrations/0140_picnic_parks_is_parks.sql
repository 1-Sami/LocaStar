-- 0140 — "Picnic parks" is "Parks".
--
-- The owner renamed the category on 2026-09-20. The names people read already
-- come from CATEGORY_NAMES in @locastar/shared ("Parks" / "Parker"), so this
-- row changes nothing on screen by itself. It matters in two places that read
-- the row's own name:
--
--   * nearby_locations returns it as category_label, and three app screens map
--     that back to a slug by English name. Until this ran, the app carried an
--     alias for the old name (RENAMED_SINCE in apps/mobile/src/lib/categories.ts);
--     with the row renamed, the alias can go.
--   * search matches the query against category names, so typing "parks" now
--     finds these places by their category — and "picnic" no longer does,
--     except where a place's own name says it.
--
-- The slug stays picknick-parks: it is in URLs, in the sitemap, and in every
-- place's category link.

update public.categories
set name = 'Parks'
where slug = 'picknick-parks';
