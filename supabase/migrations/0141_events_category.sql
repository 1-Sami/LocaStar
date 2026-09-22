-- "Events", a category for things that happen rather than places that exist.
--
-- An event had to borrow a category meant for a place: a market, a concert, a
-- meet-up or a tournament could only be "Festivals", a sport, or "Others". The
-- owner asked for Event as its own choice, 2026-09-22.
--
-- The names in both languages are in packages/shared/src/categoryNames.ts, and
-- the colour is in categoryColors.ts. The name here has to match the English
-- one there exactly: screens that only have a category's name (from
-- nearby_locations) find its slug by that name. See apps/mobile/src/lib/categories.ts.

insert into categories (name, slug, icon) values
  ('Events', 'events', 'events')
on conflict (slug) do nothing;
