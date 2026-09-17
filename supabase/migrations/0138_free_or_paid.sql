-- 0138 — Free or paid, and a search filter for it.
--
-- The app's filter sheet gets a TYPE section beside SHOW and SEASON, and the
-- add/edit screens get the same pair of buttons. This is what they write.
--
-- One three-valued column rather than the two booleans the seasons use:
-- Free and Paid are one choice, not two independent facts, and the owner
-- chose that on 2026-09-17. null is "nobody has said", which is where all
-- 8,290 imported places start — and, exactly like an untagged season, a null
-- answers neither filter rather than showing up under both.
--
-- nearby_locations is dropped and recreated rather than replaced: a new
-- parameter makes a new signature, so CREATE OR REPLACE would leave two
-- overloads behind and a call naming only the old parameters would fail as
-- ambiguous. Both statements are in this one transaction, so there is no
-- moment where search has no function to call. Old installs keep working
-- because every parameter is named and price_filter defaults to null.
--
-- The body below is 0131's, unchanged except for the parameter and the one
-- filter clause. Its comments are load-bearing — see 0131 for why the query
-- is shaped the way it is.

alter table public.locations add column if not exists is_free boolean;

comment on column public.locations.is_free is
  'true = free, false = costs money, null = not stated. Written by the app''s Free/Paid buttons; null answers neither search filter.';

drop function if exists public.nearby_locations(
  double precision, double precision, integer, text[], text, text, text, integer, text, integer
);

create or replace function public.nearby_locations(
  lat double precision,
  lng double precision,
  radius_m integer default 50000,
  category_slugs text[] default null,
  search_query text default null,
  sort text default 'distance',
  season_filter text default null,
  price_filter text default null,
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
      -- is_free is three-valued: true free, false paid, null not stated. A
      -- place nobody has said either way about answers neither filter, exactly
      -- as an untagged season does.
      and (
        nearby_locations.price_filter is null
        or (nearby_locations.price_filter = 'free' and l.is_free)
        or (nearby_locations.price_filter = 'paid' and not l.is_free)
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

-- Restated because the function was dropped and recreated above, and because
-- CREATE OR REPLACE would keep a function's grants while saying nothing about
-- them either way.
grant execute on function public.nearby_locations(
  double precision, double precision, integer, text[], text, text, text, text, integer, text, integer
) to anon, authenticated;
