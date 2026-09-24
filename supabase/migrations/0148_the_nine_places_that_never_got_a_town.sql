-- Nine hand-added places had no town.
--
-- All of them were added before the add form learned to geocode a pin the
-- person never moved: city and country are only ever filled in by the geocode,
-- there are no fields for them, so anyone who accepted where their phone put
-- them submitted both as null. Every place added since 2026-09-06 has a town.
--
-- It stopped being cosmetic when Achievements shipped: the Range badges
-- (Explorer, Well travelled, Knows the area) count distinct towns, so these
-- contributions counted for nothing. They are also invisible to town search
-- and absent from their town page.
--
-- The values come from reverse-geocoding each pin through Nominatim and
-- applying `townFromAddress` from apps/web/src/lib/geocode.ts — the same rule
-- the live add form uses — so each row gets what it would have got had it been
-- added today. Where Nominatim answers with a municipality rather than a
-- locality the municipality is what lands ("Botkyrka", not "Norsborg"); that
-- inconsistency is Nominatim's and is already present in the rows that do have
-- a town.
--
-- Targeted by id, never by a predicate.

update locations set city = 'Botkyrka',   country = 'Sweden' where id = '42479f47-37e4-4347-a157-e019654c53c7'; -- Brunna IP - Outdoor Gym
update locations set city = 'Eskilstuna', country = 'Sweden' where id = '94042b03-2d83-4458-b33c-74d1dbb4f06f'; -- Tornlekplatsen Stadsparken
update locations set city = 'Stockholm',  country = 'Sweden' where id = '6443ed79-9e30-4c97-813b-7f719ebd718b'; -- Stadsbiblioteket Stockholm
update locations set city = 'Vellinge',   country = 'Sweden' where id = 'fee380f4-648a-439d-a9ad-0c66fb47dda7'; -- Test volleyboll match
update locations set city = 'Botkyrka',   country = 'Sweden' where id = '48d05198-72c4-49f2-8736-40e788a2c4f6'; -- Grillplats Alby IP
update locations set city = 'Botkyrka',   country = 'Sweden' where id = '6880cfab-5062-402f-8ec9-44abf75ff24a'; -- Alby stadsmotionsspår
update locations set city = 'Botkyrka',   country = 'Sweden' where id = '9542e707-6e6d-48a0-8ae1-85460e8ca1db'; -- Fittja ängen utegym
update locations set city = 'Botkyrka',   country = 'Sweden' where id = '1f149ef8-acff-4570-a140-7c974ba16f3c'; -- Volleyboll Fittja äng
update locations set city = 'Boo',        country = 'Sweden' where id = 'af0e270d-b94d-4c5b-8882-1283a7604fb1'; -- Mårtens holme
