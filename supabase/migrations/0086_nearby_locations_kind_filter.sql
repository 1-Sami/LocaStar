-- Home's "Activitys" row went empty, and the reason was the bulk import.
--
-- Home asks for the nearest 200 locations and slices every section out of that
-- one list. That was fine at 290 rows. At 801 the nearest 200 from central
-- Stockholm reach 12.2 km, because Stockholm alone holds 201 basketball courts
-- — so a festival in Eskilstuna at 88.7 km was cut off by the cap long before
-- the kind === 'activity' filter ever ran. A *place* in Eskilstuna was equally
-- invisible; nothing about it being an activity mattered.
--
-- Distance is the wrong axis for activities. Someone will drive ninety minutes
-- to a festival and not five to a boule court, so activities should not be
-- competing with courts for slots in a proximity query. kind_filter lets Home
-- fetch them as their own small query with no practical distance limit, while
-- every other section keeps the behaviour it has now.
--
-- DROP then CREATE, not CREATE OR REPLACE — the same trap 0083 hit. Adding a
-- parameter changes the signature, so `create or replace` leaves the old
-- eight-argument function beside the new nine-argument one, both match an
-- eight-argument call, and PostgREST has to pick. That surfaces as an
-- intermittent 300 in production. Both statements are in one transaction, so
-- there is no window where the function is missing.
--
-- kind_filter is named so deliberately. `kind` is a column on locations, and a
-- parameter of that name would be silently shadowed by the column with no
-- error at all — which is exactly what 0077 spent an evening tracking down
-- when generated lat/lng columns ate the lat/lng parameters. It is qualified
-- as nearby_locations.kind_filter below for the same reason.
--
-- Existing app builds keep working: they pass arguments by name and
-- kind_filter takes its default of null, which means "every kind", the
-- behaviour they have today.

drop function if exists public.nearby_locations(
  double precision, double precision, integer, text[], text, text, text, integer
);

create function public.nearby_locations(
  lat double precision,
  lng double precision,
  radius_m integer default 50000,
  category_slugs text[] default null,
  search_query text default null,
  sort text default 'distance',
  season_filter text default null,
  max_results integer default 100,
  kind_filter text default null
)
returns table (
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
  result_lng double precision
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
    cover.storage_path as cover_photo_path,
    l.lat as result_lat,
    l.lng as result_lng
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
      nearby_locations.kind_filter is null
      or l.kind::text = nearby_locations.kind_filter
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

grant execute on function public.nearby_locations(
  double precision, double precision, integer, text[], text, text, text, integer, text
) to anon, authenticated, service_role;
