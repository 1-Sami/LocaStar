-- Search said "100 RESULTS" whatever the truth was.
--
-- It was counting the rows it had been handed, and 0083 capped those at 100. So
-- the number was not an estimate or a rounding — it was the cap, printed. With
-- 801 locations the app looked like it knew about an eighth of what it does,
-- and there was no way to reach the rest.
--
-- Two additions, one function rewrite:
--
--   total_count    how many rows matched, before the limit. A window function
--                  rather than a second round trip: count(*) over() is
--                  evaluated after WHERE and before LIMIT, so it sees the whole
--                  matching set while the query still returns one page. It
--                  costs nothing extra — the rows have already been found.
--
--   result_offset  where the page starts, so Search can fetch the next fifty
--                  when someone scrolls to the bottom.
--
-- Named result_offset, not offset: OFFSET is a reserved word, and a parameter
-- called `offset` would need quoting at every use. The result_ prefix follows
-- result_lat and result_lng, which exist because a returned column sharing a
-- parameter's name is silently shadowed with no error at all — the fault
-- migration 0077 spent an evening on.
--
-- DROP then CREATE. Required twice over here: the parameter list grows (which
-- would otherwise leave two functions matching the same call, the ambiguity
-- 0083 hit) and the return type gains a column, which CREATE OR REPLACE cannot
-- do at all. Both statements are in one transaction, so the function is never
-- missing.
--
-- Installed app builds keep working. They pass arguments by name; result_offset
-- defaults to 0, and the extra total_count key in the response is ignored by
-- clients that do not read it.

drop function if exists public.nearby_locations(
  double precision, double precision, integer, text[], text, text, text, integer, text
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
  limit nearby_locations.max_results
  offset nearby_locations.result_offset;
$function$;

grant execute on function public.nearby_locations(
  double precision, double precision, integer, text[], text, text, text, integer, text, integer
) to anon, authenticated, service_role;
