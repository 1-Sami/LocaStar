-- Search takes 2-3.5 seconds, and past 3 it returns nothing at all.
--
-- Three separate faults, all of which only became visible once the map grew
-- from 990 locations to 8,293.
--
-- 1. The category-name match ran once per row.
--
--    Search matches a place if its name matches, its text matches, *or* one of
--    its categories is called that — so typing "basketball" finds the courts,
--    which are mostly named after the street they sit on. That last clause was
--    written as a correlated EXISTS joining location_categories to categories
--    with c.name ilike inside it. The ilike does not depend on the row, but
--    being inside a correlated subquery it was re-run for every one:
--
--      SubPlan 1 ... (actual time=0.177..0.177 rows=0 loops=8291)
--        -> Seq Scan on categories (Rows Removed by Filter: 48)
--
--    8,291 sequential scans of a 54-row table, 26,239 of the query's 30,680
--    buffer hits. Rewritten so the categories scan references nothing outside
--    itself, the planner runs it once as a hashed subplan and probes it.
--
-- 2. Both lateral joins ran for every matching row, not for the page.
--
--    count(*) over () cannot be computed from the first fifty rows, so the
--    whole matching set is built before LIMIT — and the category and
--    cover-photo laterals were inside that set. Browsing with no filter meant
--    8,291 rows through two laterals to return 50. Fetching the page first and
--    joining afterwards keeps the exact total (the window still runs over every
--    match) while doing 50 lateral lookups instead of 8,291.
--
-- 3. ST_DWithin was measured against a radius that excludes nothing.
--
--    Search passes 20,000,000 m meaning "everywhere" — it is not a nearby
--    search like Home. That is wider than the map and defeats the GiST index,
--    so it degraded into a spheroid distance calculation per row whose answer
--    was always true. Home's real 50 km radius still takes the ST_DWithin path
--    and still uses the index.
--
-- Measured on the live database, Stockholm, warm, through the RPC as a
-- signed-in non-moderator — so with 0130 below it and RLS applied:
--
--                            before    after
--   text "basketball"       1983 ms    18 ms
--   browse, page 1           761 ms    29 ms
--   category filter          230 ms     7 ms
--   refresh, 300 rows        348 ms    32 ms
--
-- Cold, through EXPLAIN: 3400 ms and 38,841 buffers, against 28 ms and 1,108.
-- Over HTTP from a phone, the whole round trip is now 250-380 ms.
--
-- What this does NOT explain is the other half of the report — searches that
-- came back empty when there were obviously matches. anon has a 3s
-- statement_timeout and the temptation was to call that the cause, but the old
-- query timed as anon took 725 ms: signed out is the cheap case, because
-- auth.uid() is null and the public-visibility branch settles it. Nothing was
-- ever being killed. The empty results were the Search screen answering "No
-- matches." while it was still waiting for a location fix and had not run a
-- search at all; that is fixed in the app, not here.
--
-- See also 0130, which stops the read policy on locations looking up who you
-- are once per row; the two compound.
create or replace function public.nearby_locations(
  lat double precision,
  lng double precision,
  radius_m integer default 50000,
  category_slugs text[] default null,
  search_query text default null,
  sort text default 'distance',
  season_filter text default null,
  max_results integer default 100,
  kind_filter text default null,
  result_offset integer default 0
)
returns table(
  id uuid,
  kind location_kind,
  name text,
  description text,
  address text,
  city text,
  country text,
  distance_m double precision,
  avg_rating numeric,
  review_count integer,
  category_slug text,
  category_label text,
  starts_at timestamp with time zone,
  is_boosted boolean,
  available_summer boolean,
  available_winter boolean,
  cover_photo_path text,
  result_lat double precision,
  result_lng double precision,
  total_count bigint
)
language sql
stable
-- No SET search_path, for the reason given in 0129: a SET clause stops Postgres
-- inlining a SQL function. Every table is schema-qualified instead, and this is
-- STABLE and not SECURITY DEFINER, so it holds no rights of its own.
--
-- Every parameter below is written as nearby_locations.<name> and every column
-- as l.<name>. Four of the parameter names — lat, lng, name, sort — could
-- otherwise be read as columns of locations, and a column silently wins over a
-- parameter with no error at all. That is what broke every distance in the app
-- once; see migration 0077.
as $function$
  with page as materialized (
    -- Which rows, in what order, and how many there are in total. Nothing here
    -- touches a second table for the sake of a row that is about to be thrown
    -- away by the LIMIT.
    select
      l.id,
      l.kind,
      l.name,
      l.description,
      l.address,
      l.city,
      l.country,
      ST_Distance(
        l.geom,
        ST_MakePoint(nearby_locations.lng, nearby_locations.lat)::geography
      ) as distance_m,
      l.avg_rating,
      l.review_count,
      l.starts_at,
      l.is_boosted,
      l.available_summer,
      l.available_winter,
      l.lat as result_lat,
      l.lng as result_lng,
      count(*) over () as total_count
    from public.locations l
    where l.status = 'active'
      and (
        -- 20,000 km is the app's way of saying "no limit" — further than any
        -- two points on Earth are apart. Testing it would cost a spheroid
        -- calculation per row to rule nothing out.
        nearby_locations.radius_m is null
        or nearby_locations.radius_m >= 20000000
        or ST_DWithin(
          l.geom,
          ST_MakePoint(nearby_locations.lng, nearby_locations.lat)::geography,
          nearby_locations.radius_m
        )
      )
      and (
        nearby_locations.kind_filter is null
        or l.kind::text = nearby_locations.kind_filter
      )
      and (
        nearby_locations.category_slugs is null
        or array_length(nearby_locations.category_slugs, 1) is null
        or exists (
          select 1
          from public.location_categories lc
          join public.categories c on c.id = lc.category_id
          where lc.location_id = l.id
            and c.slug = any(nearby_locations.category_slugs)
        )
      )
      and (
        nearby_locations.search_query is null
        or l.search_text @@ plainto_tsquery('simple', nearby_locations.search_query)
        or l.name ilike '%' || nearby_locations.search_query || '%'
        -- ...and the activity itself: typing "basketball" or "paintball" should
        -- find the courts, not just places with the word in their name. Most
        -- imported rows are named after the street they sit on, so without this
        -- the category was reachable only through the filter sheet.
        --
        -- Written as an uncorrelated IN rather than an EXISTS correlated on
        -- l.id: which categories are called "basketball" is one question about
        -- 54 rows, not a question about this location. Kept that way it is
        -- answered once and hashed. Correlated, it was answered 8,291 times and
        -- cost more than the rest of the search put together.
        or l.id in (
          select lc.location_id
          from public.location_categories lc
          where lc.category_id in (
            select c.id
            from public.categories c
            where c.name ilike '%' || nearby_locations.search_query || '%'
          )
        )
      )
      and (
        nearby_locations.season_filter is null
        or (nearby_locations.season_filter = 'summer' and l.available_summer)
        or (nearby_locations.season_filter = 'winter' and l.available_winter)
      )
    order by
      case when nearby_locations.sort = 'rating' then l.avg_rating end desc,
      ST_Distance(
        l.geom,
        ST_MakePoint(nearby_locations.lng, nearby_locations.lat)::geography
      ) asc,
      l.id asc
    limit nearby_locations.max_results
    offset nearby_locations.result_offset
  )
  -- Now, and only now, what each of those fifty rows looks like.
  select
    p.id,
    p.kind,
    p.name,
    p.description,
    p.address,
    p.city,
    p.country,
    p.distance_m,
    p.avg_rating,
    p.review_count,
    primary_category.slug as category_slug,
    primary_category.name as category_label,
    p.starts_at,
    p.is_boosted,
    p.available_summer,
    p.available_winter,
    cover.storage_path as cover_photo_path,
    p.result_lat,
    p.result_lng,
    p.total_count
  from page p
  left join lateral (
    select c.slug, c.name
    from public.location_categories lc
    join public.categories c on c.id = lc.category_id
    where lc.location_id = p.id
    limit 1
  ) as primary_category on true
  left join lateral (
    select lp.storage_path
    from public.location_photos lp
    where lp.location_id = p.id
    order by lp.sort_order asc, lp.created_at asc
    limit 1
  ) as cover on true
  -- The CTE's order does not survive the joins, so it has to be restated. Same
  -- three keys, so the page keeps the order it was chosen in.
  order by
    case when nearby_locations.sort = 'rating' then p.avg_rating end desc,
    p.distance_m asc,
    p.id asc;
$function$;

-- Unchanged from before, and restated because CREATE OR REPLACE keeps a
-- function's grants but says nothing about them.
grant execute on function public.nearby_locations(
  double precision, double precision, integer, text[], text, text, text, integer, text, integer
) to anon, authenticated;
