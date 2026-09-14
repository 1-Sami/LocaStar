-- 0137 — Summer and winter, for the places where there is no doubt.
--
-- The season filter (Summer / Winter, on the website's finder and in the app)
-- shows a place only if that flag is set, and a place with neither flag shows
-- under neither. The import never set either, so 8,278 of 8,290 places were
-- untagged and both filters were close to empty.
--
-- The owner asked for the places that are certainly one season or the other
-- (2026-09-14). All-year places — playgrounds, dog parks, libraries — are left
-- untagged on purpose: they are not a summer or a winter activity. Only places
-- with neither flag are touched, so no season a person chose is overwritten,
-- and every row changed is logged so any of it can be undone.
--
-- Whole categories, where what the place is settles the season:
--   winter  ski slopes (landuse=winter_sports); ice rinks, the indoor halls
--           too — the ice is the winter season
--   summer  beaches, golf courses, mini golf, slipways (water-activities),
--           baseball, cricket and American football pitches
-- Mini golf less two indoor venues, Tolv Golf and Underground golf, which are
-- open all year.
--
-- Place by place, where the category is mixed:
--   Pools (Outdoors) — the importer took any pool not tagged indoor. Every pin
--   was looked up in OpenStreetMap on 2026-09-14: 23 are natural bathing spots
--   (leisure=swimming_area), 8 are pools tagged location=outdoor, and three
--   more are outdoor by name. The other 80 are indoor halls, hotel pools, or
--   pools OSM says nothing about, and stay untagged.
--   Action parks — 18 by name: the four Sommarland water parks, Gröna Lund,
--   Furuviksparken, High Chaparral, Daftöland, and the outdoor high-ropes and
--   zipline parks. Liseberg gets both: its Christmas season is winter. The
--   indoor play centres (Boda Borg, Leo's Lekland, Prison Island) are all year
--   and stay untagged.
--
-- Deliberately not tagged, because "mostly summer" is not certain: football,
-- basketball, tennis and volleyball pitches (an indoor hall is mapped the same
-- way as an outdoor court), skateparks, camping (plenty are open all year),
-- and diving (done all year in a drysuit).
--
-- Same guards as 0133-0136 (imports only, places only), and proved first with
-- a rolled-back run of this exact statement.

create table if not exists public.location_season_backfill (
  location_id uuid not null references public.locations (id) on delete cascade,
  set_summer boolean not null,
  set_winter boolean not null,
  reason text not null,
  backfilled_at timestamptz not null default now(),
  primary key (location_id, backfilled_at)
);

comment on table public.location_season_backfill is
  'Every place whose season flags were set in bulk, and why, so any of it can be undone. Internal only.';

-- Bookkeeping, not API data: RLS on with no policies, and no grants.
alter table public.location_season_backfill enable row level security;
revoke all on public.location_season_backfill from anon, authenticated;

with by_category (slug, summer, winter) as (
  values
    ('skiing', false, true),
    ('ice-skating', false, true),
    ('beaches', true, false),
    ('golf', true, false),
    ('mini-golf', true, false),
    ('water-activities', true, false),
    ('baseball', true, false),
    ('cricket', true, false),
    ('amerikan-fotball', true, false)
),
-- Keyed on id and name both, so a row that is not what was checked is skipped.
pools (id, name, why) as (
  values
    ('85c49462-6818-4d4e-a0bc-726148327021'::uuid, 'Bodalsvägen', 'bathing spot'),
    ('8dea5353-5782-41e9-9f73-59f64ec40083'::uuid, 'Brokindsleden', 'bathing spot'),
    ('0b4563bf-e820-479c-a207-afe658131074'::uuid, 'Bryggvägen', 'bathing spot'),
    ('a6b377e1-0a04-4e47-9f2d-bed73d50eede'::uuid, 'Bålsjöbadet', 'bathing spot'),
    ('c2bbc186-b843-4d71-818a-55585e424cc8'::uuid, 'Centrumvägen', 'bathing spot'),
    ('4784de13-affb-415d-aae2-5dd57a3aac4a'::uuid, 'Drabovägen', 'bathing spot'),
    ('02f01968-4ca8-4bcb-bb21-42580d768313'::uuid, 'E 507', 'bathing spot'),
    ('ed8e5ad8-d553-4cdb-95d5-0a74a006b165'::uuid, 'Frescati Hagväg', 'bathing spot'),
    ('3846f61b-2066-4d81-b5fc-aaa760c66120'::uuid, 'Gärdsjöbovägen', 'bathing spot'),
    ('c81be0e3-c44e-4d87-b49d-c15ff5d7eb4e'::uuid, 'Kottvägen', 'bathing spot'),
    ('d27f1395-c730-41d8-8688-a9d101fbad57'::uuid, 'Kungsleden', 'bathing spot'),
    ('798bd6b4-9d4e-4274-9503-679dc6729d46'::uuid, 'Kålvägen', 'bathing spot'),
    ('d1caf069-41e0-411f-a68c-9504438537cd'::uuid, 'Linden', 'bathing spot'),
    ('dd4d871b-7c5c-4e00-a947-12b04e16fb16'::uuid, 'Lingonstigen', 'bathing spot'),
    ('02633036-bb85-40d4-a354-09dfa470ddd6'::uuid, 'N 674', 'bathing spot'),
    ('03e351c5-b89e-4687-9c05-1efe0c2a00d4'::uuid, 'Skärvövägen', 'bathing spot'),
    ('556fd169-7007-463e-b838-96ada694ce4b'::uuid, 'Storvad', 'bathing spot'),
    ('9dc6f149-7390-457b-9091-0ef97517cf01'::uuid, 'Talattagatan', 'bathing spot'),
    ('ecdacac5-893e-4a69-bda9-0df01e33939d'::uuid, 'Tulebo strandväg', 'bathing spot'),
    ('880fa524-b018-431e-af11-8a5375d33de3'::uuid, 'Undenäs distrikt', 'bathing spot'),
    ('8c4c6699-3bef-41d4-ae68-76a0934d90f2'::uuid, 'Vikstensbacken', 'bathing spot'),
    ('f094768d-8395-456d-94f6-03e0e52f9531'::uuid, 'Z 527', 'bathing spot'),
    ('44a527a4-f9c2-4f71-b034-344729c1d954'::uuid, 'Z 760', 'bathing spot'),
    ('3d118e59-d15b-4c6d-b981-33e687cd5432'::uuid, 'Albertsforsvägen', 'outdoor pool'),
    ('8d3cc1d5-3cfe-42d5-9061-992069cbc67c'::uuid, 'Bergavägen', 'outdoor pool'),
    ('f5b06e7a-0d09-46d5-a2bd-e42bdacfad27'::uuid, 'Gröndalsgatan', 'outdoor pool'),
    ('b7f8ee98-6907-4ef6-b80a-37212b4875a1'::uuid, 'Krönikegatan', 'outdoor pool'),
    ('80bd1f72-6b38-404a-92ae-909c7e01884f'::uuid, 'Meijerhelmsgatan', 'outdoor pool'),
    ('edb7e0ce-fdee-44ea-8013-ad3ec5c9277d'::uuid, 'S 931', 'outdoor pool'),
    ('70826259-2a0f-41a6-ba91-dc7a2a220c53'::uuid, 'Slottsskogsleden', 'outdoor pool'),
    ('6b3c81e7-418f-41cf-90b0-9e64e1c49350'::uuid, 'Ullavigatan', 'outdoor pool'),
    ('375e016c-fbe5-4511-9c57-7ab9389c1516'::uuid, 'Johannelunds lek- och plaskdamm', 'outdoor pool, by name'),
    ('f1ea6c13-5d9a-42e9-b661-59d9d78cbf4d'::uuid, 'Kristinebergs plaskdamm', 'outdoor pool, by name'),
    ('ee5d1bd8-91fb-449c-9b66-ffa81ed3241e'::uuid, 'Oxievångsbadet', 'outdoor pool, by name')
),
parks (name, summer, winter) as (
  values
    ('Kneippbyn Sommarland', true, false),
    ('Leksand Sommarland', true, false),
    ('Skara Sommarland', true, false),
    ('Tosselilla Sommarland', true, false),
    ('Gröna Lund', true, false),
    ('Furuviksparken', true, false),
    ('High Chaparral', true, false),
    ('Daftöland', true, false),
    ('Åre Björnen klätterpark', true, false),
    ('Höghöjdsbana', true, false),
    ('Isaberg Mountain Resort - Höghöjdsbana', true, false),
    ('Sörbybacken höghöjdsbana', true, false),
    ('Upzone', true, false),
    ('Upzone Äventyrspark i Åhus', true, false),
    ('Zip Adventure Park Umeå', true, false),
    ('Liseberg', true, true)
),
wanted as (
  select l.id, b.summer, b.winter, 'category ' || b.slug as reason
  from public.locations l
  join public.location_categories lc on lc.location_id = l.id
  join public.categories c on c.id = lc.category_id
  join by_category b on b.slug = c.slug
  where not (c.slug = 'mini-golf' and l.name in ('Tolv Golf', 'Underground golf'))
  union all
  select l.id, true, false, p.why
  from public.locations l
  join pools p on p.id = l.id and p.name = l.name
  union all
  select l.id, k.summer, k.winter, 'action park by name'
  from public.locations l
  join public.location_categories lc on lc.location_id = l.id
  join public.categories c on c.id = lc.category_id and c.slug = 'action-parks'
  join parks k on k.name = l.name
),
-- One row per place, in case a place is in two of the sets above.
targets as (
  select w.id,
    bool_or(w.summer) as summer,
    bool_or(w.winter) as winter,
    string_agg(w.reason, '; ' order by w.reason) as reason
  from wanted w
  join public.locations l on l.id = w.id
  where l.created_by is null
    and l.kind = 'place'
    and l.status = 'active'
    and not l.available_summer
    and not l.available_winter
  group by w.id
),
logged as (
  insert into public.location_season_backfill (location_id, set_summer, set_winter, reason)
  select id, summer, winter, reason from targets
  returning 1
)
update public.locations l
set available_summer = t.summer,
    available_winter = t.winter
from targets t
where l.id = t.id;
