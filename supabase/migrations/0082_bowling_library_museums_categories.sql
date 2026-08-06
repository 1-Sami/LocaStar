-- Three categories asked for that did not already exist.
--
-- The other four from the same request -- Mini Golf, Ice skating, Climbing and
-- Nature reserves -- were already added by 0028 and are live, so they are
-- deliberately absent here. Re-inserting them would be a no-op thanks to the
-- conflict clause, but listing them would suggest they were missing.
--
-- "Museums (Free)" is free admission specifically, which is why the slug says
-- so: a paid museum is a different thing to someone deciding where to take the
-- kids on a rainy Sunday, and the whole point of the category is that it costs
-- nothing.
--
-- Matching card colours are in apps/mobile/src/constants/theme.ts. A category
-- with no entry there falls back to the grey used for "Others", which reads as
-- unclassified rather than as a real category — so the two have to land
-- together.

insert into categories (name, slug, icon) values
  ('Bowling', 'bowling', 'bowling'),
  ('Library', 'library', 'library'),
  ('Museums (Free)', 'museums-free', 'museums-free')
on conflict (slug) do nothing;
