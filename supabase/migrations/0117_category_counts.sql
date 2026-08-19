-- How many places each category has, in one round trip.
--
-- The sitemap needs it to leave out categories with nothing in them — a page
-- reading "0 places" is thin content, and a sitemap full of them teaches Google
-- to trust the file less. The website's "browse by activity" grid needs the
-- same numbers, and calling category_city_counts once per slug would be 54
-- queries for one page.
--
-- SECURITY INVOKER, like category_city_counts: RLS decides what is counted, so
-- a removed place or a retired activity never inflates a public number.

create or replace function public.category_counts()
returns table (slug text, name text, n bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select c.slug, c.name, count(l.id) as n
  from categories c
  left join location_categories lc on lc.category_id = c.id
  left join locations l on l.id = lc.location_id
  group by c.slug, c.name
  order by count(l.id) desc, c.name asc;
$$;

comment on function public.category_counts() is
  'Place count per category. SECURITY INVOKER so RLS still hides removed and retired rows.';

grant execute on function public.category_counts() to anon, authenticated;
