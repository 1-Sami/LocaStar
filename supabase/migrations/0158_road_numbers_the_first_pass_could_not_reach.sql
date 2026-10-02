-- The road-number names 0156 could not reach, and one more shape of the same bug.
--
-- 0156 left three categories alone because no singular Swedish noun had been
-- agreed for them, and skipping the noun meant skipping the row. But the names
-- were still road numbers, so these take the locality ALONE:
--
--     BD 805  ->  Arrenjarka        E 4   ->  Rosvik
--
-- No noun is invented, and none is needed: the page title already supplies the
-- category and the town ("Water activities in Jokkmokk"), which is the same
-- reason the 4,688 ordinary street names were left untouched.
--
-- The jogging trails are a second shape. Nine were named by their own length --
-- "2 km", "11 km" -- which is no more an identity than a route number, but the
-- distance is worth keeping, so they become "<locality> Motionsspar <length>".
--
-- Four rows are deliberately left as they are:
--   * KA 5 (football, Harnosand) is Harnosands kustartilleriregemente, a real
--     place, and its address Kanongrand agrees.
--   * Hacksta MTB-Spar sits under American football, a category excluded here.
--   * E 16, BD 805 and BD 811 sit where Nominatim knows no settlement and the
--     town name is already taken. "Jokkmokk 1" reads like a designation and
--     means nothing, so a number was not invented; they wait for a human.

update locations as l
set name = v.new_name
from (values
  ('c7cf4395-6c64-4989-9796-91ad979bbc1e'::uuid, 'Blå Grindar'),   -- was F 971  [birdwatching]
  ('17a3d5f3-c2aa-460c-a282-541fc800b9c5'::uuid, 'Grimarp'),   -- was G 602  [birdwatching]
  ('e1ca671f-99af-4315-b01d-2b02d2a03b40'::uuid, 'Kvarnared'),   -- was O 1700  [birdwatching]
  ('70d3736b-1973-4815-989a-97ccd1b11b7e'::uuid, 'Sundre'),   -- was I 500  [birdwatching]
  ('08b0dc2b-35d9-44bd-8217-907a6c493b79'::uuid, 'Södra Innervik'),   -- was AC 824  [birdwatching]
  ('3a4d8a37-af48-4c8d-ad71-2a56745c16ae'::uuid, 'Varetorp'),   -- was G 891  [birdwatching]
  ('bcd6c185-7a1c-4980-a653-211304afeba2'::uuid, 'Ynde'),   -- was E 22  [birdwatching]
  ('0bbfdf1e-d01d-439d-bd71-38db99efa116'::uuid, 'Ås'),   -- was H 925  [birdwatching]
  ('56e12e7e-29d9-4d79-bbec-f5ea267f20be'::uuid, 'Borlänge Motionsspår 1,5 km'),   -- was 1,5 km  [jogging-trails]
  ('607dd362-2217-49b3-9be0-13b940b3b6e1'::uuid, 'Borlänge Motionsspår 2,5 km'),   -- was 2,5 km  [jogging-trails]
  ('8d9b2697-8440-4e93-a656-59da6048f615'::uuid, 'Båtstad Motionsspår 7,5 km'),   -- was 7,5 km  [jogging-trails]
  ('0d81ddf6-b28d-49c5-89bf-022e3f5e31ce'::uuid, 'Gräsberg Motionsspår 9 km'),   -- was 9 km  [jogging-trails]
  ('a8a9339a-d777-46a6-9c59-6705a2e9f526'::uuid, 'Hemlingby Motionsspår 2 km'),   -- was 2 km  [jogging-trails]
  ('58539cb5-2799-4694-a0b4-39dc05f47c86'::uuid, 'Hemlingby Motionsspår 6 km'),   -- was 6 km  [jogging-trails]
  ('2aad4feb-6b9c-43a2-87e9-43a15efbe3a1'::uuid, 'Landforsen Motionsspår 2 km'),   -- was 2 km  [jogging-trails]
  ('4329c20c-50d6-465a-8e1b-67c91fe7d5de'::uuid, 'Ludvika Motionsspår 11 km'),   -- was 11 km  [jogging-trails]
  ('010bb673-6b4b-491d-a609-52c9a8423e34'::uuid, 'Mora Motionsspår 2 km'),   -- was 2 km  [jogging-trails]
  ('9d54ae6d-5e6f-44ba-9184-adade93fac01'::uuid, 'Mora Motionsspår 6 km'),   -- was 6 km  [jogging-trails]
  ('6ef2e433-2d33-4321-83a7-9a5dccab42ee'::uuid, 'Persbo Motionsspår 3 km'),   -- was 3 km  [jogging-trails]
  ('e639b730-7f66-473e-8ab5-87628f4ab386'::uuid, 'Remsle Motionsspår 4,5 km'),   -- was 4,5 km  [jogging-trails]
  ('f555231a-fce4-4396-b99d-5b0d5b854b21'::uuid, 'Skaraberg Motionsspår 4,3 km'),   -- was 4,3 km  [jogging-trails]
  ('f7633fe1-feeb-4b80-858e-307552609cab'::uuid, 'Skräddarbacken Motionsspår 1 km'),   -- was 1 km  [jogging-trails]
  ('b727318d-fd21-4458-ad5e-e11fb693fdea'::uuid, 'Spånga Motionsspår 2,5 km'),   -- was 2,5 km  [jogging-trails]
  ('87be9bb6-5512-4161-94ff-133e2bf37a6f'::uuid, 'Balingsta'),   -- was C 591  [public-art]
  ('3d6326ab-76db-406e-ab73-eb5af3b1720a'::uuid, 'Fannbyn'),   -- was Z 623  [public-art]
  ('396efd30-c666-4434-8c4e-d5eb06bd2948'::uuid, 'Gränssjö'),   -- was AC 1088  [public-art]
  ('840d1ba9-3cf4-476e-936d-6ada5d5d01ae'::uuid, 'Kvarsebo'),   -- was E 910  [public-art]
  ('7b8547ce-99aa-4872-86ae-09e65265ec45'::uuid, 'Lokstallet'),   -- was E 10  [public-art]
  ('e693eedf-2427-43e9-8852-ac08528f4ecf'::uuid, 'Rosvik'),   -- was E 4  [public-art]
  ('6c4781ba-3335-4ad4-bc7f-73c23a7ca34c'::uuid, 'Skattagård'),   -- was N 601  [public-art]
  ('71316cff-cd4d-458e-8142-661303cb1518'::uuid, 'Adolfsfors'),   -- was S 631  [water-activities]
  ('a440f283-34f3-4e87-a825-c73e06b04a79'::uuid, 'Allgunnen'),   -- was H 618  [water-activities]
  ('8883dac9-d25b-4b78-a20b-e110f8b84e8b'::uuid, 'Anundsjö'),   -- was Y 986  [water-activities]
  ('48a0adc8-170d-4e2a-a875-2713c5c36613'::uuid, 'Assjö'),   -- was F 1046  [water-activities]
  ('6c820c4d-7a5a-484c-8916-35d5c01f80eb'::uuid, 'Bellö'),   -- was F 918  [water-activities]
  ('875a5fef-421a-4106-a989-49698bf423e0'::uuid, 'Bergnäsviken'),   -- was BD 629  [water-activities]
  ('4ffe77cf-28df-4f83-92de-ba9770dfc6b0'::uuid, 'Bielite'),   -- was AC 1067  [water-activities]
  ('944250b3-f2db-428c-8b5a-f1e6f66b88dc'::uuid, 'Bjursele'),   -- was AC 701  [water-activities]
  ('655da657-beae-4c76-91d3-2973c8f5ea87'::uuid, 'Breanäs'),   -- was M 2119  [water-activities]
  ('e10faa9f-19d5-48c9-bf88-0ee337ae58cb'::uuid, 'Edsele'),   -- was Y 964  [water-activities]
  ('ddbb87b6-41a8-4dd3-8f6f-625b1501f3ec'::uuid, 'Fagerlund'),   -- was BD 805  [water-activities]
  ('5d661e33-dcb0-4776-800c-ed9fcfa68a5c'::uuid, 'Fättjaur'),   -- was AC 1088  [water-activities]
  ('777d8dbf-098d-4db4-86ea-ad0427899ffc'::uuid, 'Hinneryd'),   -- was G 506  [water-activities]
  ('16e6468f-7487-438e-9f0c-b354770756c3'::uuid, 'Höversby'),   -- was E 766  [water-activities]
  ('4970fdf5-e418-4367-87b9-481880439f49'::uuid, 'Jonsboda'),   -- was G 567  [water-activities]
  ('09f7cb98-ee89-4e5a-a94e-31c46fff6eb8'::uuid, 'Jorm'),   -- was Z 819  [water-activities]
  ('00ec9ed1-a8de-4e88-afcf-70533b25f87a'::uuid, 'Jukkasjärvi'),   -- was BD 875  [water-activities]
  ('6c3814ce-30fb-4235-85e2-127d0b3c7f06'::uuid, 'Kallön'),   -- was BD 612  [water-activities]
  ('8a550a75-332c-4db9-80bf-13e52b975ec2'::uuid, 'Klintemåla'),   -- was H 752  [water-activities]
  ('f62e19c8-ebeb-466c-90d5-f9bb4ad850c9'::uuid, 'Krokstrand'),   -- was O 1052  [water-activities]
  ('ad64fecb-88f6-4f25-a4c7-468017c0eb6b'::uuid, 'Laisvall'),   -- was BD 625  [water-activities]
  ('4da98d9d-b549-4ce2-8c0c-9accd888d86e'::uuid, 'Lickershamn'),   -- was I 709  [water-activities]
  ('d85fc028-c218-46b3-98ac-e0a366a5167a'::uuid, 'Mangskog'),   -- was S 877  [water-activities]
  ('319943db-0248-4015-b945-2d804fa8d584'::uuid, 'Nora'),   -- was Y 825  [water-activities]
  ('1fb77a77-d89d-4608-95ca-a6fcf304a9f3'::uuid, 'Norrbyn'),   -- was AC 506  [water-activities]
  ('6d5e637c-03ed-41a8-89b9-e909e6472100'::uuid, 'Nottebäck'),   -- was G 910  [water-activities]
  ('49f4570d-1aaa-4828-b594-a767751fb490'::uuid, 'Nyköping'),   -- was D 766  [water-activities]
  ('e39aa067-c2ff-4698-8038-dabc50604872'::uuid, 'Ratan'),   -- was AC 662  [water-activities]
  ('49293f47-6e20-42ba-9570-94b9784327b1'::uuid, 'Rörtången'),   -- was O 617  [water-activities]
  ('3470a0fe-3d67-4dbc-92d8-267c87ed419f'::uuid, 'Silvergruvan'),   -- was T 786  [water-activities]
  ('843ca4fd-7c9c-452b-8746-1db630ef62d2'::uuid, 'Sjöändan'),   -- was S 915  [water-activities]
  ('d3d8a400-aa30-4e80-bd24-677ac58a7e52'::uuid, 'Stenberga'),   -- was F 782  [water-activities]
  ('9686fe2f-524e-4164-8feb-1f62ccd99f9a'::uuid, 'Sunnemo'),   -- was S 829  [water-activities]
  ('bd637fe7-0a37-4452-b9c8-560610b3abd9'::uuid, 'Södra Kärrnäset'),   -- was Z 801  [water-activities]
  ('30c3ee47-18fe-440e-8dcd-60ac99fdefed'::uuid, 'Sösjö'),   -- was Z 712  [water-activities]
  ('162a7be4-8b74-4ef9-a8f6-cd64947b5ba8'::uuid, 'Tunnerstad'),   -- was F 1001  [water-activities]
  ('e0621d95-5dec-4fcf-872a-db93b665ae01'::uuid, 'Tyttbo'),   -- was W 712  [water-activities]
  ('32e5707d-159e-4c1e-9ec0-d1891bb5d535'::uuid, 'Uppsala'),   -- was C 661  [water-activities]
  ('884184c6-75d8-4a57-bd5b-5b43f4d64711'::uuid, 'Årrenjarka'),   -- was BD 805  [water-activities]
  ('22a85dc9-fb80-4d6a-9e2c-9647cafa9d09'::uuid, 'Åsensbruk'),   -- was O 2224  [water-activities]
  ('1d34b476-1731-49ed-bb47-0c083d18bed0'::uuid, 'Östanbäck'),   -- was AC 1018  [water-activities]
  ('e8df18f5-6703-4fe1-b47c-9a3b2451e067'::uuid, 'Östra Spöland'),   -- was AC 628  [water-activities]
  ('bb37e709-e724-4ff2-970e-64954e3949a9'::uuid, 'Övernäs')   -- was BD 630  [water-activities]
) as v(id, new_name)
where l.id = v.id;
