-- ---------------------------------------------------------------------------
-- New activity categories (flat, no grouping — Ballcourt sports added as
-- independent top-level categories rather than a parent/child hierarchy).
-- ---------------------------------------------------------------------------

insert into categories (name, slug, icon) values
  ('Roads', 'roads', 'road'),
  ('Gyms (Outside)', 'gyms-outside', 'gym'),
  ('Basketball', 'basketball', 'basketball'),
  ('Football (Soccer)', 'football', 'football'),
  ('Cricket', 'cricket', 'cricket'),
  ('Baseball', 'baseball', 'baseball'),
  ('Bike trails', 'bike-trails', 'bike'),
  ('Cross-country (friluftsplats)', 'cross-country', 'trail'),
  ('Water activities', 'water-activities', 'water'),
  ('Parks', 'parks', 'park'),
  ('Other', 'other', 'other')
on conflict (slug) do nothing;
