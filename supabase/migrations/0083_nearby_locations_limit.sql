-- nearby_locations has never had a LIMIT, and both Search and Home ask for a
-- 20 000 km radius, which is "everything". With six locations that is
-- invisible. With the ten thousand we are about to import it is the entire
-- table, serialised over the wire, on every debounced keystroke.
--
-- Fixing it before the import rather than after: afterwards the first symptom
-- is the app feeling broken on mobile data, and the cause is three layers away
-- from where it hurts.
--
-- DROP then CREATE, not CREATE OR REPLACE. Adding a parameter changes the
-- signature, so `create or replace` would leave the old seven-argument function
-- in place beside the new eight-argument one. Both would then match a
-- seven-argument call and PostgREST would have to pick, which is exactly the
-- kind of ambiguity that shows up as an intermittent 300 in production. The
-- drop and create are in one transaction, so there is no window where the
-- function is missing.
--
-- Existing app builds keep working: they pass the first seven arguments by
-- name and max_results takes its default.
--
-- 100 is a deliberate default rather than "big enough". A list nobody scrolls
-- past 100 of does not need 10 000 rows to render, and Home slices its sections
-- to ten anyway.

drop function if exists public.nearby_locations(
  double precision, double precision, integer, text[], text, text, text
);

create function public.nearby_locations(
  lat double precision,
  lng double precision,
  radius_m integer default 50000,
  category_slugs text[] default null::text[],
  search_query text default null::text,
  sort text default 'distance'::text,
  season_filter text default null::text,
  max_results integer default 100
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
    end asc
  limit nearby_locations.max_results;
$function$;

comment on function public.nearby_locations is
  'Locations within radius_m of a point, with distance, capped at max_results.
   The lat/lng/radius_m/max_results parameters are deliberately qualified as
   nearby_locations.<name> in the body: locations has columns of some of those
   names, and an unqualified reference resolves to the column instead of the
   parameter (see migration 0077).';
