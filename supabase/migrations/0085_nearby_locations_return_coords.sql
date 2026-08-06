-- The Directions button was routing people to the middle of a street.
--
-- openDirections took the ADDRESS STRING and let Google or Apple geocode it.
-- For most of what LocaStar lists that is useless: a basketball court in a park
-- has no house number, so its address is a whole street. Handed
-- "Furuholmsstigen, 127 47 Stockholm", Google routes to the street midpoint, or
-- to an arbitrary building range on it -- "Fleminggatan 47-45" -- or fails to
-- resolve it at all. People arrive a hundred metres away, find nothing, and
-- reasonably report the listing as wrong.
--
-- The coordinates were accurate the whole time and were being thrown away. The
-- search card could not do better even in principle, because this function did
-- not return them.
--
-- result_lat / result_lng, NOT lat / lng. Those are the parameter names, and a
-- returns-table column sharing a parameter name is the same ambiguity that
-- silently broke every distance in 0077.
--
-- Body otherwise identical to 0083.

drop function if exists public.nearby_locations(
  double precision, double precision, integer, text[], text, text, text, integer
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
  available_summer boolean, available_winter boolean, cover_photo_path text,
  result_lat double precision, result_lng double precision
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
  'Locations within radius_m of a point, capped at max_results. Returns the
   location coordinates as result_lat/result_lng -- deliberately NOT lat/lng,
   which are the parameter names, and a returns-table column sharing a parameter
   name is the ambiguity that broke every distance in 0077. The Directions
   button needs these: routing to the address string sends people to the middle
   of a street rather than to a court in a park.';
