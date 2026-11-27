-- Remove 60 "Pools (Outdoors)" places that are, or may be, private pools.
--
-- The OpenStreetMap import took every leisure=swimming_pool not tagged
-- indoor or access=private (tools/osm-import.mjs), and most garden pools carry
-- no access tag at all. So the category held pools in people's gardens, named
-- after the street they are on. Flagged 2026-09-14; on 2026-11-27 the owner
-- asked for the private ones to go, and for anything uncertain to go too:
-- "It is better to remove one that is a pool than having one that is a
-- private garden."
--
-- Every pool was re-matched to OSM by position (nearest object, all within
-- 251 m) and kept only on positive evidence that it is public: a natural
-- bathing place (swimming_area), a real name or a municipal website,
-- access=yes, or sitting inside a known public bath. 52 kept, 60 removed.
-- Removed: OSM-private, hotel/camping/resort pools for guests only, a hot tub,
-- a duplicate, and every unnamed street-named pool with nothing showing it is
-- public, which includes some that may well be public. That trade-off was the
-- owner's explicit choice.
--
-- None of the 60 had a review, photo, save, list entry or creator: all
-- imported, untouched. All are in the owner's backup of 2026-11-27
-- (LocaStar-backups/2026-11-27/db.dump), which is how to bring one back.
-- The id is the target, never a filter: see test_accounts in memory.

with removed(id, place, reason) as (values
  ('6b3c81e7-418f-41cf-90b0-9e64e1c49350', 'Ullavigatan, Örebro', 'way/43657918 · unnamed pool, no sign of public access'),
  ('80bd1f72-6b38-404a-92ae-909c7e01884f', 'Meijerhelmsgatan, Örebro', 'way/248796464 · unnamed pool, no sign of public access'),
  ('a39d814f-659d-4a55-9920-9580e0b9e50e', 'Långby Utomhusbad, Västerås', 'way/1165646972 · unnamed pool, no sign of public access'),
  ('b7f8ee98-6907-4ef6-b80a-37212b4875a1', 'Krönikegatan, Örebro', 'way/1358389396 · unnamed pool, no sign of public access'),
  ('f094768d-8395-456d-94f6-03e0e52f9531', 'Hedeviken Utomhusbad, Härjedalen', 'way/981702506 · guests only'),
  ('0a0c7900-e363-401b-9b17-b8816037e742', 'Övre Brännmarksvägen, Älvsbyn', 'way/658226494 · unnamed pool, no sign of public access'),
  ('33ceb960-80c1-4a0f-a4ad-7ded8f63ed97', 'Uppsalavägen, Tierp', 'way/319411681 · unnamed pool, no sign of public access'),
  ('c910dc1a-e058-4636-8af2-02e0f9e6d634', 'Framgårdsvägen, Älvdalen', 'node/13416779158 · unnamed pool, no sign of public access'),
  ('0905e61f-7e06-4ec2-829e-2a6845639ce7', 'Sörbyn, Boden', 'way/1427506503 · unnamed pool, no sign of public access'),
  ('f2dead0e-46c0-4c13-aedc-05a50b410fe9', 'Östersunds, Östersund', 'way/1373175525 · unnamed pool, no sign of public access'),
  ('6f1a0cd9-4c89-4732-b57d-8c3382a4e2f2', 'Rullervägen, Varberg', 'way/1353170452 · unnamed pool, no sign of public access'),
  ('21b37da5-6ddf-4f5f-bbf0-b5cfd7d5dac8', 'Timmermansgatan, Jokkmokk', 'way/1252264178 · unnamed pool, no sign of public access'),
  ('208cdc4c-2bca-41dd-b29f-03da77c74a24', 'Pitevägen, Arvidsjaur', 'way/224236068 · unnamed pool, no sign of public access'),
  ('46200d78-5e64-43fc-bd47-93be8c00c5ec', 'Inlandsvägen, Strömsund', 'way/541720573 · unnamed pool, no sign of public access'),
  ('d0c9a095-5bb1-4c48-be45-a8bf3e42236c', 'Snäckvägen, Kristianstad', 'way/1289815299 · unnamed pool, no sign of public access'),
  ('e85f2128-9465-4730-9c85-789962fffa81', 'Volvogatan, Falköping', 'way/216513698 · unnamed pool, no sign of public access'),
  ('1128d5b2-7dd4-4306-b9ae-720c4928971a', 'Sagavägen, Strömsund', 'way/291508159 · unnamed pool, no sign of public access'),
  ('b771a171-e57e-48bf-81e4-81aafe904aa5', 'Kustvägen, Skurup', 'way/1149456472 · hot tub'),
  ('c8f7742c-43b0-48e3-838e-712c1e2478f5', 'Iskällareliden, Göteborg', 'way/1017017000 · unnamed pool, no sign of public access'),
  ('bf3f76ff-81f3-4ce4-9cdb-bc5bec230cfc', 'Klagshamnsvägen, Bunkeflostrand', 'way/211789932 · unnamed pool, no sign of public access'),
  ('01142384-e549-4f2a-b8cf-4e294a362f46', 'Sörgärdesvägen, Nacka', 'way/775580078 · unnamed pool, no sign of public access'),
  ('d2687dd7-b9d3-461f-a5f3-8e65a5ea2a16', 'Trumpetvägen, Järfälla', 'way/1297182228 · OSM access=private'),
  ('e78dd7fb-e57e-4f0b-aacc-fdecb2339065', 'Segerstadsvägen, Växjö', 'way/1432083133 · unnamed pool, no sign of public access'),
  ('156f5cef-c340-46a9-afe4-b20e120209f1', 'Jarlabankes väg, Täby', 'way/237669338 · unnamed pool, no sign of public access'),
  ('4d1c124b-dd80-4f68-bbd2-47286bff2df7', 'Ekåsvägen, Göteborg', 'way/1322922770 · unnamed pool, no sign of public access'),
  ('95aad3dc-a237-46a7-a9e5-c7366c5592d1', 'Gränsstigen, Malmö', 'way/172921442 · unnamed pool, no sign of public access'),
  ('37ff50d5-66de-4508-a883-347de855fbb3', 'Stora Holms Säteri, Göteborg', 'way/1372369293 · private estate'),
  ('04ddcc9e-7bf0-4a31-a6ee-82a1c6bdbecc', 'Blomstergatan, Örebro', 'way/230511297 · unnamed pool, no sign of public access'),
  ('bc9b266c-1bfa-4993-8afd-b24ffcd08f73', 'Syster Stinas väg, Gävle', 'way/835117892 · unnamed pool, no sign of public access'),
  ('c74d8a81-fa33-4e68-a37f-a2a69a46da01', 'Vårby allé, Huddinge', 'node/2199689624 · unnamed pool, no sign of public access'),
  ('5ba94afd-2e85-41d8-9417-af61c5175888', 'Segesvängen, Malmö', 'way/29037277 · unnamed pool, no sign of public access'),
  ('f3bf1fbc-8387-4a5b-9b0d-e4fb16578b48', 'Nygatan, Umeå', 'way/465222761 · duplicate of Navet (Västra Kyrkogatan)'),
  ('4aad19f3-b283-41f1-9ddd-b685983185e5', 'Sjungarbacken, Malung-Sälen', 'way/842879729 · guests only'),
  ('174045d2-2fac-4224-a0d7-df02ecd76d1b', 'Uddenvägen, Pajala', 'way/1550774495 · unnamed pool, no sign of public access'),
  ('3a4428e4-9311-467e-93de-549427289262', 'Norra Heden Utomhusbad, Sala', 'way/781553337 · unnamed pool, no sign of public access'),
  ('50798c35-43bf-4f4a-9406-a4ce97b0632b', 'Överby Utomhusbad, Uddevalla', 'way/1088022012 · unnamed pool, no sign of public access'),
  ('5470bf25-7aa2-4264-8afa-e8fc02307801', 'Jättendal, Nordanstig', 'node/8841354259 · unnamed pool, no sign of public access'),
  ('c6e1a642-3e74-40c9-91be-d482dde70ac9', 'Höjdvägen, Årjäng', 'way/1087239336 · unnamed pool, no sign of public access'),
  ('173be32a-bdbe-44e2-b72e-b2d5cf5cc999', 'Furuborgsvägen, Nykvarn', 'way/1500658756 · unnamed pool, no sign of public access'),
  ('dcbb7a3e-265b-48c5-a24f-1b72c080d438', 'Siljegårdsvägen, Leksand', 'way/264787852 · unnamed pool, no sign of public access'),
  ('6953ab52-271a-484f-a332-58d4da5b9123', 'Folketshusvägen, Högsjö', 'way/360978266 · unnamed pool, no sign of public access'),
  ('65bc1728-d3d1-4e76-bf2f-5d2b17cf286a', 'Skolgatan, Norsjö', 'node/2024605285 · unnamed pool, no sign of public access'),
  ('c47ae985-7524-4347-813a-008ae5d4b3e8', 'Doktorsgatan, Värnamo', 'way/533185634 · unnamed pool, no sign of public access'),
  ('851b219e-72db-4ba6-853b-22e0c680dc4d', 'Grävlingstigen, Karlskrona', 'way/130442100 · unnamed pool, no sign of public access'),
  ('70826259-2a0f-41a6-ba91-dc7a2a220c53', 'Slottsskogsleden, Håbo', 'way/937257806 · unnamed pool, no sign of public access'),
  ('2be9c544-ef59-4e97-8333-672aeaec8799', 'Fjällboholmarvägen, Norrtälje', 'way/308421720 · unnamed pool, no sign of public access'),
  ('cf5dc776-33d7-4389-9e5f-70c668ecda90', 'Värdshusvägen, Orsa', 'way/611059890 · guests only'),
  ('313af167-bfcf-4f18-ab17-a4e88b26a6e4', 'Silkesstigen, Vålberg', 'way/1089311425 · unnamed pool, no sign of public access'),
  ('0690940c-25a9-4dc3-b6f9-eef3a4c2942e', 'Gotlands, Gotland', 'way/869453663 · unnamed pool, no sign of public access'),
  ('3866c263-4a37-4ae3-b802-37e71c4e8b52', 'Gothem Åminnevägen, Gotland', 'way/707428453 · unnamed pool, no sign of public access'),
  ('dbc07da0-267a-4f4b-803f-978eda41131d', 'Kosta, Lessebo', 'way/484201903 · unnamed pool, no sign of public access'),
  ('edb7e0ce-fdee-44ea-8013-ad3ec5c9277d', 'Bergsäng Utomhusbad, Hagfors', 'way/724739400 · unnamed pool, no sign of public access'),
  ('eaaa2bba-e812-416b-8c84-d08a6230b288', 'Fiskaretorpsvägen, Götene', 'way/601386174 · unnamed pool, no sign of public access'),
  ('4903f682-5854-4a72-a479-f41c64a8684e', 'Ängsvägen, Alvesta', 'way/1076338813 · guests only'),
  ('11c1e7e4-1fb6-4d62-8249-350b626fb8f4', 'Hällavägen, Ragunda', 'way/1206328513 · OSM access=no'),
  ('5a8640bd-4064-4171-847c-71e511ae9b03', 'Vinbäcksleden, Arboga', 'way/556774945 · unnamed pool, no sign of public access'),
  ('910e5802-f948-4aa0-9957-2ac05a068fa7', 'Hagagatan, Malung', 'way/1537136405 · guests only'),
  ('b7c33291-8fe5-4ad2-b146-e9eb97034521', 'Byavägen, Gällivare', 'node/5347844076 · unnamed pool, no sign of public access'),
  ('f5b06e7a-0d09-46d5-a2bd-e42bdacfad27', 'Gröndalsgatan, Oskarshamn', 'way/704329498 · guests only (Best Western Corallen)'),
  ('6b252ebe-cc29-4393-adec-204098ed2f40', 'Sankt Örjansvägen, Skellefteå', 'node/1337608770 · unnamed pool, no sign of public access')
)
delete from locations l
using removed r
where l.id = r.id::uuid
  and l.created_by is null
  and l.review_count = 0;
