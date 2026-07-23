-- Replace the activity/location category list with the new master list.
-- Existing categories that are still in use by real locations (basketball,
-- bmx, festival, golf, other, outdoor, playgrounds, roads, skiing) are
-- renamed in place so their ids (and therefore existing location_categories
-- rows) stay valid. Unused categories that have no equivalent in the new
-- list are dropped. Everything else is a fresh insert.

update categories set name = 'Others' where slug = 'other';
update categories set name = 'Outdoor recreations area (Friluftsplats)' where slug = 'outdoor';
update categories set name = 'Playground' where slug = 'playgrounds';
update categories set name = 'Ski slope' where slug = 'skiing';
update categories set name = 'Soccer' where slug = 'football';
update categories set name = 'Gyms (outdoor)' where slug = 'gyms-outside';
update categories set name = 'Hiking Trails' where slug = 'hiking';
update categories set name = 'Pools (Outdoors)' where slug = 'swimming';

-- Unused (usage_count = 0) categories with no equivalent in the new list.
delete from categories where slug = 'cross-country';
delete from categories where slug = 'parks';
delete from categories where slug = 'restaurants';

insert into categories (name, slug, icon) values
  ('4H Farms', '4h-farms', '4h-farms'),
  ('Archery Ranges', 'archery-ranges', 'archery-ranges'),
  ('Action parks', 'action-parks', 'action-parks'),
  ('Amerikan Fotball', 'amerikan-fotball', 'amerikan-fotball'),
  ('Birdwatching', 'birdwatching', 'birdwatching'),
  ('Boule', 'boule', 'boule'),
  ('Camping', 'camping', 'camping'),
  ('Climbing', 'climbing', 'climbing'),
  ('Dog parks', 'dog-parks', 'dog-parks'),
  ('Diving spots', 'diving-spots', 'diving-spots'),
  ('Disc Golf (Frisbee)', 'disc-golf-frisbee', 'disc-golf-frisbee'),
  ('Fishing', 'fishing', 'fishing'),
  ('Grill sites', 'grill-sites', 'grill-sites'),
  ('Historical Ruins/Places', 'historical-ruins-places', 'historical-ruins-places'),
  ('Ice skating', 'ice-skating', 'ice-skating'),
  ('Jogging Trails', 'jogging-trails', 'jogging-trails'),
  ('Motocross/ATV tracks', 'motocross-atv-tracks', 'motocross-atv-tracks'),
  ('Mini Golf', 'mini-golf', 'mini-golf'),
  ('Nature reserves', 'nature-reserves', 'nature-reserves'),
  ('Obstacle course', 'obstacle-course', 'obstacle-course'),
  ('Paintball', 'paintball', 'paintball'),
  ('Parkour', 'parkour', 'parkour'),
  ('Picknick parks', 'picknick-parks', 'picknick-parks'),
  ('Public art', 'public-art', 'public-art'),
  ('Race tracks (Vehicle)', 'race-tracks-vehicle', 'race-tracks-vehicle'),
  ('Scenic Place', 'scenic-place', 'scenic-place'),
  ('Skatepark', 'skatepark', 'skatepark'),
  ('Tennis', 'tennis', 'tennis'),
  ('Track & Fields Stadium', 'track-and-field-stadium', 'track-and-field-stadium'),
  ('Volleyball', 'volleyball', 'volleyball')
on conflict (slug) do nothing;
