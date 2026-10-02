-- 31 places were named after a trail that runs past them.
--
-- Sibling of 0156 and the same line of code: geocodeMissing takes Nominatim's
-- `road` for the name, and beside an exercise track that road IS the track. So
-- a skatepark came out called "Dalarö elljusspår" — while the real Dalarö
-- elljusspår is a separate row 500 m away, correctly filed under jogging-trails.
-- Reverse-geocoding each of these confirmed it: for every single row Nominatim's
-- road came back as the trail name now stored as the place's name.
--
-- Only the name is treated as wrong. Whether a skatepark stands beside that
-- track is OSM's claim and nothing here disproves it, so no category is changed
-- and no row is deleted.
--
-- Rows whose category IS a trail keep their names. "Bäckby motionsspår" under
-- jogging-trails, "Vandringsled Roparudden" under hiking and "Jättendals
-- elljusspår" under skiing are all simply correct, and 37 such rows were left
-- alone. One row is left for the owner: "Hacksta MTB-Spår" under American
-- football, a category deliberately excluded from this pass.
--
-- Three nature trails in Österåker got no settlement of any kind back from
-- Nominatim, so the town stands in — still better than three rows called
-- "Naturstig".

update locations as l
set name = v.new_name
from (values
  ('4b6aa1f8-ec0f-4628-abc5-4d20a072ac5b'::uuid, 'Österåker Äventyrspark'),   -- was Naturstig  [action-parks]
  ('3e88d5cc-645e-484e-a20c-420ed1b7ce3a'::uuid, 'Flemingsberg Bågskyttebana'),   -- was Visättra elljusspår  [archery-ranges]
  ('414fd3ed-d20f-4cc5-bbf5-dd15ee61dfb7'::uuid, 'Kungsbacka Basketplan'),   -- was Tölö tvärled  [basketball]
  ('a99d9dd1-a85e-4c62-b799-69519df75b22'::uuid, 'Nydala fritidsområde Strand'),   -- was Nydala Reflexbana  [beaches]
  ('ac1d4009-b0f8-4dc6-bb5a-d0967977b8e2'::uuid, 'Slättberg Discgolfbana'),   -- was Elljusspår Orsa  [disc-golf-frisbee]
  ('06b525e7-499b-4652-ba76-28c6109dd62b'::uuid, 'Långsjö Hundrastgård'),   -- was Älvsjöskogens elljusspår  [dog-parks]
  ('495eab16-9bd5-411e-bc14-dd6dd722778b'::uuid, 'Stugsund Hundrastgård'),   -- was Elljusspår  [dog-parks]
  ('6efe861e-6850-4a1c-8ace-9f2fe368d8cd'::uuid, 'Änge Fotbollsplan'),   -- was Änge Eljusspår  [football]
  ('98819900-01fb-4456-8364-efc3035a49fb'::uuid, 'Ol-Jans Fotbollsplan'),   -- was elljusspår  [football]
  ('0777470c-8c1e-45fa-bdc1-ebef80122f4a'::uuid, 'Slättberg Fotbollsplan'),   -- was Elljusspår Orsa  [football]
  ('c4e1783e-3c70-4077-9114-3332af3463e8'::uuid, 'Kärr Fotbollsplan'),   -- was Elljusspåret - 2.5 km  [football]
  ('53702205-fc3a-4e45-8b6e-4b2464bc61fe'::uuid, 'Skärplinge Fotbollsplan'),   -- was Motionsspår  [football]
  ('08651738-bff6-4e29-9754-3fd40824e65d'::uuid, 'Österåker Fotbollsplan'),   -- was Naturstig  [football]
  ('cb23e5fe-660f-4c85-b81d-ede33979fd06'::uuid, 'Skårdal Grillplats'),   -- was Aspen naturstig  [grill-sites]
  ('385e9f95-da60-4449-86df-99d80646a019'::uuid, 'Hovslätt Utegym'),   -- was El ljuspår 2.5km  [gyms-outside]
  ('54357f12-ee7e-4a0b-8765-4433d1c46292'::uuid, 'Rosenlund Utegym'),   -- was Elljusspår  [gyms-outside]
  ('9b257ede-c81e-48fe-ad41-a0652af0a1d5'::uuid, 'Gränby Utegym'),   -- was Elljusspår 2.4 km  [gyms-outside]
  ('e0b8135f-cfbc-4101-974e-8fb4edb0cc76'::uuid, 'Hylta Utegym'),   -- was Elljusspåret  [gyms-outside]
  ('7d9255ba-1a5b-490e-8ec6-725539132f14'::uuid, 'Tärnsjö Utegym'),   -- was Elljusspåret  [gyms-outside]
  ('41f0a85d-e45e-483b-943a-6daa27fd11ef'::uuid, 'Enviken Utegym'),   -- was Envikens elljusspår  [gyms-outside]
  ('ddb8f457-870c-4551-b8f7-4992f61a86a1'::uuid, 'Sigridsborg Utegym'),   -- was Motionsspår  [gyms-outside]
  ('1ff0b107-11cc-4448-a97f-879123e9c03f'::uuid, 'Stöpen Utegym'),   -- was Stöpens elljusspår  [gyms-outside]
  ('3b2cd973-1c3b-4b4f-bce4-f652ca8e507e'::uuid, 'Hok Isbana'),   -- was Elljusspår  [ice-skating]
  ('7a2e1f9c-a6c0-496e-a6f4-11c9cc4e889e'::uuid, 'Schweizerdalen Parkourpark'),   -- was Dalarö elljusspår  [parkour]
  ('a464d71f-efbc-4bfb-8da8-9066688cccc3'::uuid, 'Carlshöjd Park'),   -- was Reflexbana Tomtebo-Gimonäs  [picknick-parks]
  ('2430bc02-8fb3-4ce1-aa95-084bdb397184'::uuid, 'Hok Lekplats'),   -- was Elljusspår  [playgrounds]
  ('3f864a7c-064b-495e-bbdc-8d9b8b319a56'::uuid, 'Österåker Lekplats'),   -- was Naturstig  [playgrounds]
  ('6b856e11-9a24-4e12-b171-d04a263dce00'::uuid, 'Finsta Skjutbana'),   -- was Elljusspår  [shooting-range]
  ('018d96c9-287a-4b1d-a568-e496366bb1e0'::uuid, 'Schweizerdalen Skatepark'),   -- was Dalarö elljusspår  [skatepark]
  ('388b3fd2-d0d8-4209-b52e-fca7df517353'::uuid, 'Nydala fritidsområde Utomhusbad'),   -- was Nydala Reflexbana  [swimming]
  ('6e4259bb-77c6-4db2-ae2f-c5c6eeab359b'::uuid, 'Nydala fritidsområde Tennisbana')   -- was Nydala elljusspår 1.8 km  [tennis]
) as v(id, new_name)
where l.id = v.id;
