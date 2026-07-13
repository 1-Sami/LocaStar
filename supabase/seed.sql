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

-- Sample Stockholm-area locations so the real data pipeline has something to
-- show before any user has submitted a real location.
insert into locations (id, kind, name, description, address, geom, status, avg_rating, review_count) values
  ('a1000000-0000-4000-8000-000000000001', 'place', 'Stockholm Golfklubb', 'Founded in 1904 — the second oldest golf club in Sweden. A beautifully maintained parkland course near Danderyd with over 120 years of history.', 'Kevinge Strand 22, 182 57 Danderyd', ST_MakePoint(18.0567, 59.4021)::geography, 'active', 4.6, 152),
  ('a1000000-0000-4000-8000-000000000002', 'place', 'Grödinge Golfklubb', 'A relaxed, welcoming course south of Stockholm, popular with local weekend players.', 'Grödinge, Sweden', ST_MakePoint(17.8916, 59.0987)::geography, 'active', 3.0, 63),
  ('a1000000-0000-4000-8000-000000000003', 'place', 'Brukets Skidbacke', 'A small but scenic ski slope with well-groomed runs for beginners and families.', 'Sweden', ST_MakePoint(18.20, 59.35)::geography, 'active', 4.5, 46),
  ('a1000000-0000-4000-8000-000000000004', 'place', 'Ekebybacken', 'Steeper runs and a great view over the valley — a favorite for more experienced skiers.', 'Sweden', ST_MakePoint(18.05, 59.30)::geography, 'active', 4.5, 46),
  ('a1000000-0000-4000-8000-000000000005', 'place', 'BMX Haninge', 'A dirt BMX track with jumps for all skill levels, tucked into the forest outside Haninge.', 'Haninge, Sweden', ST_MakePoint(18.1667, 59.1667)::geography, 'active', 4.5, 46),
  ('a1000000-0000-4000-8000-000000000006', 'place', 'Flottsbro', 'Rolling green hills popular for hiking, sledding in winter, and picnics in summer.', 'Huddinge, Sweden', ST_MakePoint(17.9328, 59.2255)::geography, 'active', 4.5, 46),
  ('a1000000-0000-4000-8000-000000000007', 'activity', 'Haninge Mat festival', 'An annual food festival with local vendors, live music, and family activities.', 'Haninge, Sweden', ST_MakePoint(18.1333, 59.1667)::geography, 'active', 4.5, 46)
on conflict (id) do nothing;

insert into location_categories (location_id, category_id)
select l.id, c.id from (values
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'golf'),
  ('a1000000-0000-4000-8000-000000000002'::uuid, 'golf'),
  ('a1000000-0000-4000-8000-000000000003'::uuid, 'skiing'),
  ('a1000000-0000-4000-8000-000000000004'::uuid, 'skiing'),
  ('a1000000-0000-4000-8000-000000000005'::uuid, 'bmx'),
  ('a1000000-0000-4000-8000-000000000006'::uuid, 'outdoor'),
  ('a1000000-0000-4000-8000-000000000007'::uuid, 'festival')
) as mapping(location_id, category_slug)
join locations l on l.id = mapping.location_id
join categories c on c.slug = mapping.category_slug
on conflict do nothing;
