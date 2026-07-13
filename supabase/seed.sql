insert into categories (name, slug, icon) values
  ('Golf', 'golf', 'golf'),
  ('Swimming', 'swimming', 'swimming'),
  ('BMX', 'bmx', 'bmx'),
  ('Skiing', 'skiing', 'skiing'),
  ('Hiking', 'hiking', 'hiking'),
  ('Playgrounds', 'playgrounds', 'playground'),
  ('Beaches', 'beaches', 'beach'),
  ('Restaurants', 'restaurants', 'restaurant'),
  ('Festivals', 'festival', 'festival'),
  ('Outdoor', 'outdoor', 'outdoor')
on conflict (slug) do nothing;
