-- 0135 — Fourteen more genitive town names, found by reading the list.
--
-- 0134 picked its three from a pattern of common Swedish town endings, and the
-- pattern was the mistake: it did not include -lands, -ens, -ums, -ers, and so
-- missed "Gotlands" — 80 places, the largest single case of all. After 0134
-- every remaining town ending in s (42 of them) was read by eye instead. 28
-- are real towns whose names end in s (Borås, Västerås, Alingsås, Åhus, Djurås,
-- Porjus…) and are left alone. These 14 are municipality genitives, the same
-- import error as 0133 and 0134. 273 places.
--
-- Where the municipality's name is not the name of its main town — Berg
-- (Svenstavik), Mark (Kinna), Tanum — the municipality is still what the import
-- meant and what the rest of the data uses for those places, so it is kept.
--
-- Same guards and the same rolled-back proof first: 273 updated, 0 other
-- columns changed.

with map (old_city, new_city) as (
  values
    ('Gotlands', 'Gotland'), ('Härjedalens', 'Härjedalen'), ('Malung-Sälens', 'Malung-Sälen'),
    ('Tanums', 'Tanum'), ('Österåkers', 'Österåker'), ('Nordanstigs', 'Nordanstig'),
    ('Bergs', 'Berg'), ('Marks', 'Mark'), ('Tjörns', 'Tjörn'), ('Ovanåkers', 'Ovanåker'),
    ('Gagnefs', 'Gagnef'), ('Dals-Eds', 'Dals-Ed'), ('Salems', 'Salem'), ('Gullspångs', 'Gullspång')
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
  select id, old_city, new_city, old_address, new_address, 'kommun genitive, read by eye'
  from targets
  returning 1
)
update public.locations l
set city = t.new_city,
    address = t.new_address
from targets t
where l.id = t.id;
