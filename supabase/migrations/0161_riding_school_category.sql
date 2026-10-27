-- "Riding school" / "Ridskola", asked for by the owner 2026-10-27.
--
-- Separate from "Horse track" (90 places), which is the oval you race or trot
-- on. A ridskola is somewhere you go to be taught, usually with stables and
-- hired horses, and someone looking for lessons is not looking for a track.
-- Folding the two together would have made the larger category useless for
-- both.
--
-- The names in both languages are in packages/shared/src/categoryNames.ts, and
-- the colour is in categoryColors.ts. The name here has to match the English
-- one there exactly: screens that only have a category's name (from
-- nearby_locations) find its slug by that name. See apps/mobile/src/lib/categories.ts.
--
-- No placeholder illustration yet, so a riding school with no photo shows the
-- flat colour tile — the same as Events. Adding one is a .webp in
-- apps/web/public/placeholders/ plus a line in placeholderImages.ts.

insert into categories (name, slug, icon) values
  ('Riding school', 'riding-school', 'riding-school')
on conflict (slug) do nothing;
