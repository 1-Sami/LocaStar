-- What a category landing page needs that PostgREST cannot ask for.
--
-- /activity/<slug> is the SEO engine: one page per category, listing the
-- cities that have places in it with a count each, every chip linking into a
-- filtered search. That is a GROUP BY, and PostgREST has no way to express it,
-- so it has to be a function.
--
-- Counting client-side would work today at 996 rows and stop working at the
-- 100 000 per country the owner expects. Doing it in the database is the same
-- amount of code and does not have that cliff.
--
-- SECURITY INVOKER on purpose: the caller is `anon`, and RLS on `locations`
-- must apply exactly as it does everywhere else, so a removed place or a
-- retired activity is not counted into a public total.

create or replace function public.category_city_counts(p_slug text)
returns table (city text, n bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select l.city, count(*) as n
  from locations l
  join location_categories lc on lc.location_id = l.id
  join categories c on c.id = lc.category_id
  where c.slug = p_slug
    and l.city is not null
  group by l.city
  order by count(*) desc, l.city asc;
$$;

comment on function public.category_city_counts(text) is
  'City facets for /activity/<slug>. SECURITY INVOKER so RLS still hides removed and retired rows from the count.';

-- Read-only and self-limiting; the website calls it anonymously.
grant execute on function public.category_city_counts(text) to anon, authenticated;
