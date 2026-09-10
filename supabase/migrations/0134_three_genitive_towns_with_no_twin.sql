-- 0134 — Three more genitive town names, the ones 0133 could not see.
--
-- 0133 corrected a genitive town ("Linköpings") only where the plain form
-- ("Linköping") was also in the data, because that twin is what made the case
-- certain. These three have no twin — no place anywhere says "Borgholm" — so
-- they slipped through, but they are the same import error: the municipality
-- is Borgholms / Lekebergs / Ljusnarsbergs kommun, and stripping " kommun"
-- left the genitive s. 45 places.
--
-- The rule was not widened to "any town ending in s", deliberately. Checked on
-- 2026-09-10: that would have "corrected" Strängnäs, Hagfors, Höganäs, Bollnäs,
-- Bengtsfors, Degerfors, Vännäs, Hofors and a dozen more real towns whose
-- names simply end in s, introducing the error it set out to remove. So these
-- are named one by one.
--
-- Same guards as 0133 — imports only, places only — and proved the same way
-- with a rolled-back run first: 45 updated, 0 other columns changed.

with map (old_city, new_city) as (
  values ('Borgholms', 'Borgholm'), ('Lekebergs', 'Lekeberg'), ('Ljusnarsbergs', 'Ljusnarsberg')
),
targets as (
  select
    l.id,
    l.city as old_city,
    m.new_city,
    l.address as old_address,
    case
      when l.address = m.old_city then m.new_city
      when l.address like '% ' || m.old_city
        then left(l.address, length(l.address) - length(m.old_city)) || m.new_city
      else l.address
    end as new_address
  from public.locations l
  join map m on m.old_city = l.city
  where l.created_by is null
    and l.kind = 'place'
),
logged as (
  insert into public.location_city_corrections (location_id, old_city, new_city, old_address, new_address, reason)
  select id, old_city, new_city, old_address, new_address, 'kommun genitive, no twin'
  from targets
  returning 1
)
update public.locations l
set city = t.new_city,
    address = t.new_address
from targets t
where l.id = t.id;
