-- Three categories that were being carried by categories meant for something
-- else.
--
-- "Archery Ranges" had become every kind of range, so a rifle club sat under a
-- bow. "Race tracks (Vehicle)" had become every kind of racing, so a radio
-- controlled car club sat under motorsport — Västerorts RC Sportklubb is a
-- field for models, and someone looking for a circuit to drive on does not want
-- it. Neither category was wrong to exist; they were just the only shelf
-- available.
--
-- Matching card colours go in apps/mobile/src/constants/theme.ts. A category
-- with no entry there falls back to the grey used for "Others", which reads as
-- unclassified rather than as a real category — so the two have to land
-- together.

insert into categories (name, slug, icon) values
  ('Horse track', 'horse-track', 'horse-track'),
  ('RC Race track', 'rc-race-track', 'rc-race-track'),
  ('Shooting range', 'shooting-range', 'shooting-range')
on conflict (slug) do nothing;
