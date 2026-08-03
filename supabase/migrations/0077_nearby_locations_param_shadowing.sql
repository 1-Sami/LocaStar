-- Every search result reported a distance of exactly 0, and "sort by distance"
-- ordered rows arbitrarily.
--
-- Cause: 0076 added generated `lat` and `lng` columns to `locations`. This
-- function takes parameters of the same two names. In a SQL-language function
-- an unqualified name that matches both a parameter and a column of a table in
-- the current query resolves to *the column* -- the parameter loses, silently
-- and without a warning. So `ST_MakePoint(lng, lat)` stopped meaning "the point
-- the user searched from" and started meaning `ST_MakePoint(l.lng, l.lat)`:
-- each location's distance to itself.
--
-- Two consequences, both live in production until now:
--   * distance_m was 0 for every row, so the card read "0 m" and the
--     distance sort compared a column of zeros;
--   * ST_DWithin(geom, <that same point>, radius_m) is unconditionally true, so
--     radius_m stopped filtering anything at all.
--
-- The fix is to qualify the parameters with the function name, which is the
-- documented way to win that precedence fight (PostgreSQL 38.5.1). Renaming the
-- parameters would work too, but they are part of the RPC's public signature --
-- PostgREST callers pass `lat`/`lng` by name, so a rename would break every app
-- build already installed on a phone until it updated. Qualifying fixes those
-- clients the moment this lands, with no app change at all.
--
-- Body is otherwise identical to 0072.

create or replace function public.nearby_locations(
  lat double precision,
  lng double precision,
  radius_m integer default 50000,
  category_slugs text[] default null::text[],
  search_query text default null::text,
  sort text default 'distance'::text,
  season_filter text default null::text
)
returns table(
  id uuid, kind location_kind, name text, description text, address text,
  city text, country text, distance_m double precision, avg_rating numeric,
  review_count integer, category_slug text, category_label text,
  starts_at timestamp with time zone, is_boosted boolean,
  available_summer boolean, available_winter boolean, cover_photo_path text
)
language sql
stable
set search_path to 'public'
as $function$
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
    primary_category.slug as category_slug,
    primary_category.name as category_label,
    l.starts_at,
    l.is_boosted,
    l.available_summer,
    l.available_winter,
    cover.storage_path as cover_photo_path
  from locations l
  left join lateral (
    select c.slug, c.name
    from location_categories lc
    join categories c on c.id = lc.category_id
    where lc.location_id = l.id
    limit 1
  ) as primary_category on true
  left join lateral (
    select lp.storage_path
    from location_photos lp
    where lp.location_id = l.id
    order by lp.sort_order asc, lp.created_at asc
    limit 1
  ) as cover on true
  where l.status = 'active'
    and ST_DWithin(
      l.geom,
      ST_MakePoint(nearby_locations.lng, nearby_locations.lat)::geography,
      nearby_locations.radius_m
    )
    and (
      category_slugs is null
      or array_length(category_slugs, 1) is null
      or exists (
        select 1 from location_categories lc
        join categories c on c.id = lc.category_id
        where lc.location_id = l.id and c.slug = any(category_slugs)
      )
    )
    and (
      search_query is null
      or l.search_text @@ plainto_tsquery('simple', search_query)
      or l.name ilike '%' || search_query || '%'
    )
    and (
      season_filter is null
      or (season_filter = 'summer' and l.available_summer)
      or (season_filter = 'winter' and l.available_winter)
    )
  order by
    case when sort = 'rating' then l.avg_rating end desc,
    case
      when sort = 'distance' or sort is null
      then ST_Distance(
        l.geom,
        ST_MakePoint(nearby_locations.lng, nearby_locations.lat)::geography
      )
    end asc;
$function$;

comment on function public.nearby_locations is
  'Locations within radius_m of a point, with distance. The lat/lng parameters
   are deliberately qualified as nearby_locations.lat / nearby_locations.lng in
   the body: locations has columns of those names, and an unqualified reference
   would resolve to the column instead of the parameter.';
