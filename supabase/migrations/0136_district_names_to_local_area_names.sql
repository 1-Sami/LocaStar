-- 0136 — District names become the local area's name.
--
-- In Västernorrland and Västerbotten the import got a Swedish "distrikt" back
-- as the town — the registration districts drawn from the old parishes, 2016 —
-- so 305 places were in "Alnö distrikt", "Nordmalings distrikt", "Sundsvalls
-- Gustav Adolfs distrikt". Nobody writes that on an envelope or types it into
-- a search.
--
-- The owner chose the local area over the municipality (2026-09-10): a place on
-- Alnö is on Alnö, not "in Sundsvall", and it is what the postal addresses up
-- there mostly say. So the word "distrikt" goes, and so does the genitive s it
-- forced onto the name — except where the s is the name's own: Arnäs and
-- Ytterlännäs end in -näs. The two city-centre church districts become their
-- city: Sundsvalls Gustav Adolfs → Sundsvall, Härnösands domkyrkodistrikt →
-- Härnösand. "Indals-Lidens kommundel" is the same kind of thing and follows
-- the same rule.
--
-- An explicit list rather than a pattern, so what ran is what was read: all 62
-- rows were checked by eye before this was written.
--
-- Same guards as 0133-0135 (imports only, places only), and proved the same way
-- first with a rolled-back run of this exact statement.

with map (old_city, new_city) as (
  values
    ('Ådals-Lidens distrikt', 'Ådals-Liden'),
    ('Alnö distrikt', 'Alnö'),
    ('Anundsjö distrikt', 'Anundsjö'),
    ('Arnäs distrikt', 'Arnäs'),
    ('Attmars distrikt', 'Attmar'),
    ('Bjärtrå distrikt', 'Bjärtrå'),
    ('Björna distrikt', 'Björna'),
    ('Bjurholms distrikt', 'Bjurholm'),
    ('Borgsjö distrikt', 'Borgsjö'),
    ('Eds distrikt', 'Ed'),
    ('Edsele distrikt', 'Edsele'),
    ('Fjällsjö distrikt', 'Fjällsjö'),
    ('Forshälla distrikt', 'Forshälla'),
    ('Gideå distrikt', 'Gideå'),
    ('Gnarps distrikt', 'Gnarp'),
    ('Graninge distrikt', 'Graninge'),
    ('Grundsunda distrikt', 'Grundsunda'),
    ('Gudmundrå distrikt', 'Gudmundrå'),
    ('Häggdångers distrikt', 'Häggdånger'),
    ('Härnösands domkyrkodistrikt', 'Härnösand'),
    ('Hässjö distrikt', 'Hässjö'),
    ('Haverö distrikt', 'Haverö'),
    ('Helgums distrikt', 'Helgum'),
    ('Högsjö distrikt', 'Högsjö'),
    ('Holms distrikt', 'Holm'),
    ('Indals distrikt', 'Indal'),
    ('Indals-Lidens kommundel', 'Indals-Liden'),
    ('Junsele distrikt', 'Junsele'),
    ('Långsele distrikt', 'Långsele'),
    ('Ljungs distrikt', 'Ljung'),
    ('Ljustorps distrikt', 'Ljustorp'),
    ('Mo distrikt', 'Mo'),
    ('Nätra distrikt', 'Nätra'),
    ('Njurunda distrikt', 'Njurunda'),
    ('Nora distrikt', 'Nora'),
    ('Nordingrå distrikt', 'Nordingrå'),
    ('Nordmalings distrikt', 'Nordmaling'),
    ('Örnsköldsviks distrikt', 'Örnsköldsvik'),
    ('Ramsele distrikt', 'Ramsele'),
    ('Resele distrikt', 'Resele'),
    ('Säbrå distrikt', 'Säbrå'),
    ('Sättna distrikt', 'Sättna'),
    ('Selångers distrikt', 'Selånger'),
    ('Sidensjö distrikt', 'Sidensjö'),
    ('Själevads distrikt', 'Själevad'),
    ('Skogs distrikt', 'Skog'),
    ('Skönsmons distrikt', 'Skönsmon'),
    ('Skorpeds distrikt', 'Skorped'),
    ('Sollefteå distrikt', 'Sollefteå'),
    ('Stigsjö distrikt', 'Stigsjö'),
    ('Sundsvalls Gustav Adolfs distrikt', 'Sundsvall'),
    ('Tåsjö distrikt', 'Tåsjö'),
    ('Timrå distrikt', 'Timrå'),
    ('Torps distrikt', 'Torp'),
    ('Trehörningsjö distrikt', 'Trehörningsjö'),
    ('Tuna distrikt', 'Tuna'),
    ('Tynderö distrikt', 'Tynderö'),
    ('Uddevalla distrikt', 'Uddevalla'),
    ('Ullångers distrikt', 'Ullånger'),
    ('Vibyggerå distrikt', 'Vibyggerå'),
    ('Viksjö distrikt', 'Viksjö'),
    ('Ytterlännäs distrikt', 'Ytterlännäs')
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
  select id, old_city, new_city, old_address, new_address, 'district name to local area'
  from targets
  returning 1
)
update public.locations l
set city = t.new_city,
    address = t.new_address
from targets t
where l.id = t.id;
