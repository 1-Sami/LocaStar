-- Three more shapes of the import bug, all pre-existing rather than new.
--
--   "Savsjo distrikt" x21 -- a registration district, not a place. The importer
--     already strips this when deriving the TOWN (townFromNominatim) and
--     migration 0136 settled the rule: the word goes, and so does the genitive s
--     it put on the name, so "Ljurs distrikt" is Ljur. It was simply never
--     applied to the NAME field, only to the town.
--
--   "Glesbygd Indal" x3 -- glesbygd is a statistical classifier for sparse
--     countryside. The same junk this pass had to filter out of its own
--     reverse-geocoding before writing 0156.
--
--   "2,5 km" x2 -- distance names outside jogging-trails, where 0158 only
--     looked. The distance is dropped rather than carried: it belonged to the
--     exercise track the name was taken from, and a football pitch and an
--     outdoor gym do not have a length.
--
-- Four rows are still left for a human, deliberately: KA 5 (a real regiment
-- site), Hacksta MTB-Spar (American football, excluded), and E 16 / BD 805 /
-- BD 811, where Nominatim knows no settlement and the town name is taken.

update locations as l
set name = v.new_name
from (values
  ('0df1b5be-b295-452c-95ee-ce2ab1313535'::uuid, 'Bjurbäck Lekplats'),   -- was Bjurbäcks distrikt  [playgrounds]
  ('ede3ed4d-4927-4b1c-95d4-eb3b824bb8a6'::uuid, 'Brandstorp Lekplats'),   -- was Brandstorps distrikt  [playgrounds]
  ('42cbeca5-c0a0-4922-874e-90b2884c5dd6'::uuid, 'Bringetofta Vandringsled'),   -- was Bringetofta distrikt  [hiking]
  ('f6111a30-0aa7-4a05-9a1b-9fca2cd47e0b'::uuid, 'Dalby'),   -- was Dalby distrikt  [water-activities]
  ('562c7ebe-4430-4b6a-aeee-37c1e10dec7f'::uuid, 'Fryksände Fotbollsplan'),   -- was Fryksände distrikt  [football]
  ('be90c649-f3d7-4b5c-ab5a-c75cb79dc831'::uuid, 'Indal Fotbollsplan'),   -- was Glesbygd Indal  [football]
  ('892368a5-7ec3-45f3-ac3b-e8d683058fa4'::uuid, 'Krånge Boulebana'),   -- was Glesbygd Krånge  [boule]
  ('2aff19d6-09b9-40e0-8e06-91ec769408bb'::uuid, 'Lena-Bergstena Strand'),   -- was Lena-Bergstena distrikt  [beaches]
  ('b798b1d3-41fb-4dcf-ad35-76876336064c'::uuid, 'Ljur Fotbollsplan'),   -- was Ljurs distrikt  [football]
  ('32a666bb-3d42-46df-b077-08999c1ff3e8'::uuid, 'Loböle Boulebana'),   -- was Glesbygd Loböle, Vigge  [boule]
  ('35cb2cb5-3cd7-4134-aa0d-8e3715e7e4f4'::uuid, 'Nordmaling Strand'),   -- was Nordmalings distrikt  [beaches]
  ('f1628d90-fe1e-4f9f-8a12-e9ae564d4a61'::uuid, 'Norra Ny Lekplats'),   -- was Norra Ny distrikt  [playgrounds]
  ('620f6283-31ff-4d57-9775-9930ede6f2d9'::uuid, 'Nätra Strand'),   -- was Nätra distrikt  [beaches]
  ('efaca9b9-e51d-4ce6-b282-62615eb5107c'::uuid, 'Ramsele'),   -- was Ramsele distrikt  [water-activities]
  ('b2fb0c5b-b9c2-4233-8e60-e8c5e223f2aa'::uuid, 'Remmene Fotbollsplan'),   -- was Remmene distrikt  [football]
  ('4709cefa-4287-473f-b263-92d5ed4074b0'::uuid, 'Rosvik Utegym'),   -- was 2,8km  [gyms-outside]
  ('9bbb8560-e380-4dc7-a077-785049f424da'::uuid, 'Sandhem Lekplats'),   -- was Sandhems distrikt  [playgrounds]
  ('3d633c83-9581-4424-aacf-f868e403cb68'::uuid, 'Sävsjö Fotbollsplan'),   -- was Sävsjö distrikt  [football]
  ('eb650a3a-b507-4777-845f-e989bf876685'::uuid, 'Sävsjö Skatepark'),   -- was Sävsjö distrikt  [skatepark]
  ('adf1227a-139a-4889-b12b-956b7d3c0d4e'::uuid, 'Timrå'),   -- was Timrå distrikt  [water-activities]
  ('30e98592-72b2-47f4-9270-5e7e26ab5232'::uuid, 'Torp Fotbollsplan'),   -- was Torps distrikt  [football]
  ('880fa524-b018-431e-af11-8a5375d33de3'::uuid, 'Undenäs Utomhusbad'),   -- was Undenäs distrikt  [swimming]
  ('8d3848de-fe4e-4bf8-9151-4b8ed9dae9fa'::uuid, 'Vireda Lekplats'),   -- was Vireda distrikt  [playgrounds]
  ('ed3fc13d-0009-4f77-9e73-e1132444978a'::uuid, 'Vitsand Lekplats'),   -- was Vitsand distrikt  [playgrounds]
  ('61a8b765-8d04-4042-aa1f-f3074669123b'::uuid, 'Ytterhogdal Fotbollsplan'),   -- was Ytterhogdal distrikt  [football]
  ('de311066-76cb-446b-892a-f21c51aa5b4e'::uuid, 'Ärla Fotbollsplan')   -- was 2,5 km  [football]
) as v(id, new_name)
where l.id = v.id;
