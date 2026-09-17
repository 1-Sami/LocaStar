-- 0139 — Free or paid, for the categories where there is no doubt.
--
-- 0138 added the column; every one of the 8,290 imported places starts null,
-- which answers neither filter. The owner asked for the certain ones to be
-- filled in (2026-09-17), the same bargain as the seasons in 0137.
--
-- Free: what a Swedish municipality builds and leaves open — playgrounds, dog
-- parks, outdoor gyms, skateparks, courts and pitches, trails, nature
-- reserves, beaches, picnic and grill sites, bird hides, public art, and the
-- libraries and the museums whose category is "free admission" by definition.
--
-- Paid: what you cannot do without paying at the door — a green fee, a lift
-- pass, a lane, a pitch on a campsite, a ticket to a theme park or a high-ropes
-- course, a paintball session, a round of mini golf.
--
-- Also the 23 lake and sea bathing spots identified in 0137 by their OSM tag
-- (leisure=swimming_area): those are free. The rest of "Pools (Outdoors)" is
-- not — municipal outdoor baths charge, hotel pools are for guests — and stays
-- null rather than being guessed at.
--
-- Left alone on purpose, because the same category holds both kinds: tennis and
-- other bookable courts, ice rinks, climbing (crags free, halls not), fishing
-- (a permit is usually needed), shooting and archery ranges, motorsport,
-- horse tracks, disc golf, slipways, 4H farms, and athletics stadiums.
--
-- Same guards as 0133-0137: imports only, places only, active only, and only
-- rows nobody has answered yet. Every row is logged so it can be undone.

create table if not exists public.location_price_backfill (
  location_id uuid not null references public.locations (id) on delete cascade,
  set_free boolean not null,
  reason text not null,
  backfilled_at timestamptz not null default now(),
  primary key (location_id, backfilled_at)
);

comment on table public.location_price_backfill is
  'Every place whose free/paid value was set in bulk, and why, so any of it can be undone. Internal only.';

-- Bookkeeping, not API data: RLS on with no policies, and no grants.
alter table public.location_price_backfill enable row level security;
revoke all on public.location_price_backfill from anon, authenticated;

with by_category (slug, free) as (
  values
    ('library', true),
    ('museums-free', true),
    ('playgrounds', true),
    ('dog-parks', true),
    ('gyms-outside', true),
    ('nature-reserves', true),
    ('beaches', true),
    ('picknick-parks', true),
    ('grill-sites', true),
    ('hiking', true),
    ('jogging-trails', true),
    ('bike-trails', true),
    ('birdwatching', true),
    ('outdoor', true),
    ('public-art', true),
    ('skatepark', true),
    ('parkour', true),
    ('basketball', true),
    ('football', true),
    ('golf', false),
    ('mini-golf', false),
    ('skiing', false),
    ('bowling', false),
    ('camping', false),
    ('action-parks', false),
    ('paintball', false)
),
-- The bathing spots, by the same ids 0137 used.
bathing (id) as (
  values
    ('85c49462-6818-4d4e-a0bc-726148327021'::uuid),
    ('8dea5353-5782-41e9-9f73-59f64ec40083'::uuid),
    ('0b4563bf-e820-479c-a207-afe658131074'::uuid),
    ('a6b377e1-0a04-4e47-9f2d-bed73d50eede'::uuid),
    ('c2bbc186-b843-4d71-818a-55585e424cc8'::uuid),
    ('4784de13-affb-415d-aae2-5dd57a3aac4a'::uuid),
    ('02f01968-4ca8-4bcb-bb21-42580d768313'::uuid),
    ('ed8e5ad8-d553-4cdb-95d5-0a74a006b165'::uuid),
    ('3846f61b-2066-4d81-b5fc-aaa760c66120'::uuid),
    ('c81be0e3-c44e-4d87-b49d-c15ff5d7eb4e'::uuid),
    ('d27f1395-c730-41d8-8688-a9d101fbad57'::uuid),
    ('798bd6b4-9d4e-4274-9503-679dc6729d46'::uuid),
    ('d1caf069-41e0-411f-a68c-9504438537cd'::uuid),
    ('dd4d871b-7c5c-4e00-a947-12b04e16fb16'::uuid),
    ('02633036-bb85-40d4-a354-09dfa470ddd6'::uuid),
    ('03e351c5-b89e-4687-9c05-1efe0c2a00d4'::uuid),
    ('556fd169-7007-463e-b838-96ada694ce4b'::uuid),
    ('9dc6f149-7390-457b-9091-0ef97517cf01'::uuid),
    ('ecdacac5-893e-4a69-bda9-0df01e33939d'::uuid),
    ('880fa524-b018-431e-af11-8a5375d33de3'::uuid),
    ('8c4c6699-3bef-41d4-ae68-76a0934d90f2'::uuid),
    ('f094768d-8395-456d-94f6-03e0e52f9531'::uuid),
    ('44a527a4-f9c2-4f71-b034-344729c1d954'::uuid)
),
wanted as (
  select l.id, b.free, 'category ' || b.slug as reason
  from public.locations l
  join public.location_categories lc on lc.location_id = l.id
  join public.categories c on c.id = lc.category_id
  join by_category b on b.slug = c.slug
  union all
  select l.id, true, 'bathing spot'
  from public.locations l
  join bathing on bathing.id = l.id
),
-- One row per place. A place in two of these categories is only taken where
-- they agree; where they disagree it is exactly the doubtful case this
-- migration is built to leave alone.
targets as (
  select w.id,
    bool_and(w.free) as free,
    string_agg(distinct w.reason, '; ') as reason
  from wanted w
  join public.locations l on l.id = w.id
  where l.created_by is null
    and l.kind = 'place'
    and l.status = 'active'
    and l.is_free is null
  group by w.id
  having bool_and(w.free) = bool_or(w.free)
),
logged as (
  insert into public.location_price_backfill (location_id, set_free, reason)
  select id, free, reason from targets
  returning 1
)
update public.locations l
set is_free = t.free
from targets t
where l.id = t.id;
