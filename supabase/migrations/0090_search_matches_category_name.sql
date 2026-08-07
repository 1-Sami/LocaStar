-- Searching for the activity, not just the name.
--
-- "Basketball" in the search box found nothing useful, because the search only
-- looked at a location's own name and description. Most imported rows are named
-- after the street they sit on — Kanaans väg, Storängsvägen — so the word
-- "basketball" appears nowhere on a basketball court. The category was
-- reachable only by opening the filter sheet and hunting for it.
--
-- CREATE OR REPLACE is safe here, unlike 0086 and 0087: the signature and the
-- return type are both unchanged, so no second overload can appear. Only the
-- search clause differs.
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
  result_lng double precision,
  total_count bigint
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
    l.lng as result_lng,
    count(*) over () as total_count
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
      -- ...and the activity itself: typing "basketball" or "paintball" should
      -- find the courts, not just places with the word in their name. Most
      -- imported rows are named after the street they sit on, so without this
      -- the category was reachable only through the filter sheet.
      or exists (
        select 1 from location_categories lc
        join categories c on c.id = lc.category_id
        where lc.location_id = l.id and c.name ilike '%' || search_query || '%'
      )
    )
    and (
      season_filter is null
      or (season_filter = 'summer' and l.available_summer)
      or (season_filter = 'winter' and l.available_winter)
    )
  order by
    case when sort = 'rating' then l.avg_rating end desc,
    ST_Distance(
      l.geom,
      ST_MakePoint(nearby_locations.lng, nearby_locations.lat)::geography
    ) asc,
    l.id asc
  limit nearby_locations.max_results
  offset nearby_locations.result_offset;
$function$;
