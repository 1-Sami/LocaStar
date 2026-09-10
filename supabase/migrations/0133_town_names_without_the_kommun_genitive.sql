-- 0133 — Town names without the kommun genitive.
--
-- The OpenStreetMap import (tools/osm-import.mjs) filled a missing town from
-- Nominatim's municipality and stripped " kommun" from it. Swedish municipality
-- names are genitive, so "Linköpings kommun" left "Linköpings". 1,556 places
-- across 105 towns carried a name like that, each beside the correct spelling
-- ("Linköping", 127 places), so one town was two in every filter and card, and
-- the category-per-town pages would have printed "Basketball in Linköpings".
--
-- Only the certain case is corrected here: a name ending in s whose form
-- without the s is itself a town in the data. All 105 pairs were read by eye
-- first; every one is a municipality's genitive. District names ("Nordmalings
-- distrikt") and genitives with no twin are left for a reviewed mapping.
--
-- The address line was built from the same value ("…, 585 71 Linköpings", or
-- just "Arjeplogs" where there was no street), so it is corrected with it.
-- search_text is generated from address and follows on its own.
--
-- Every row touched is an import (created_by is null), a place rather than an
-- activity, and not removed. Checked beforehand, and proved with a
-- rolled-back run on 2026-09-10: 1,556 updated, 0 other columns changed — none
-- of the BEFORE UPDATE triggers on locations does anything to these rows but
-- pass them through.

create table if not exists public.location_city_corrections (
  location_id uuid not null references public.locations (id) on delete cascade,
  old_city text,
  new_city text,
  old_address text,
  new_address text,
  reason text not null,
  corrected_at timestamptz not null default now(),
  primary key (location_id, corrected_at)
);

comment on table public.location_city_corrections is
  'Old and new town/address for every bulk correction of imported places, so any of them can be undone. Internal only.';

-- Bookkeeping, not API data: RLS on with no policies, and no grants.
alter table public.location_city_corrections enable row level security;
revoke all on public.location_city_corrections from anon, authenticated;

with twins as (
  select c.city as old_city, left(c.city, length(c.city) - 1) as new_city
  from (select city from public.locations where city is not null group by city) c
  where c.city like '%s'
    and exists (select 1 from public.locations b where b.city = left(c.city, length(c.city) - 1))
),
targets as (
  select
    l.id,
    l.city as old_city,
    t.new_city,
    l.address as old_address,
    case
      when l.address = t.old_city then t.new_city
      when l.address like '% ' || t.old_city
        then left(l.address, length(l.address) - length(t.old_city)) || t.new_city
      else l.address
    end as new_address
  from public.locations l
  join twins t on t.old_city = l.city
  where l.created_by is null
    and l.kind = 'place'
),
logged as (
  insert into public.location_city_corrections (location_id, old_city, new_city, old_address, new_address, reason)
  select id, old_city, new_city, old_address, new_address, 'kommun genitive'
  from targets
  returning 1
)
update public.locations l
set city = t.new_city,
    address = t.new_address
from targets t
where l.id = t.id;
