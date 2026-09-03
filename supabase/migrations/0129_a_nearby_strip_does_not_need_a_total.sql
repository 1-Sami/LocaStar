-- The place page spends 575ms counting rows it never shows.
--
-- nearby_locations ends with `count(*) over () as total_count`, which the
-- search screens need: the app prints "996 RESULTS" and the website pages
-- through them. A window function cannot be computed from the first five rows,
-- so Postgres has to build the entire matching set — every row inside the
-- radius, each one through both lateral joins for its category and its cover
-- photo — before the LIMIT throws almost all of it away.
--
-- The place page asks for five and shows four, as "More basketball nearby". It
-- has never read total_count. Measured against the live database, Stockholm,
-- basketball, 50km:
--
--   nearby_locations, as it stands          646 ms
--   the same query without count(*) over ()  71 ms
--
-- That is most of a page that takes 1.3-2.3 seconds to serve, and it is 16,578
-- of the addresses in the sitemap — so it is also most of what a crawl costs,
-- both in time and in database load. Supabase is on the free plan and the app
-- shares it.
--
-- A separate function rather than a flag on the existing one: a window
-- function cannot be switched off by a parameter inside a single SQL
-- statement, and nothing that currently works should have to change to get
-- this. Same arguments, same columns, minus the count.
create or replace function public.nearby_locations_brief(
  lat double precision,
  lng double precision,
  radius_m integer default 50000,
  category_slugs text[] default null,
  season_filter text default null,
  max_results integer default 5,
  kind_filter text default null
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
  result_lng double precision
)
language sql
stable
-- Deliberately no SET search_path. A SET clause stops Postgres inlining a SQL
-- function, which is what left the planner unable to use locations_geom_idx:
-- 487ms opaque against 135ms inlined. Every table below is schema-qualified
-- instead, so the search_path cannot change what this reads, and the function
-- is STABLE and not SECURITY DEFINER, so it holds no rights of its own.
as $function$
  select
    l.id,
    l.kind,
    l.name,
    l.description,
    l.address,
    l.city,
    l.country,
    ST_Distance(l.geom, ST_MakePoint(nearby_locations_brief.lng, nearby_locations_brief.lat)::geography) as distance_m,
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
  from public.locations l
  left join lateral (
    select c.slug, c.name
    from public.location_categories lc
    join public.categories c on c.id = lc.category_id
    where lc.location_id = l.id
    limit 1
  ) as primary_category on true
  left join lateral (
    select lp.storage_path
    from public.location_photos lp
    where lp.location_id = l.id
    order by lp.sort_order asc, lp.created_at asc
    limit 1
  ) as cover on true
  where l.status = 'active'
    and ST_DWithin(
      l.geom,
      ST_MakePoint(nearby_locations_brief.lng, nearby_locations_brief.lat)::geography,
      nearby_locations_brief.radius_m
    )
    and (nearby_locations_brief.kind_filter is null or l.kind::text = nearby_locations_brief.kind_filter)
    and (
      category_slugs is null
      or array_length(category_slugs, 1) is null
      or exists (
        select 1 from public.location_categories lc
        join public.categories c on c.id = lc.category_id
        where lc.location_id = l.id and c.slug = any(category_slugs)
      )
    )
    and (
      season_filter is null
      or (season_filter = 'summer' and l.available_summer)
      or (season_filter = 'winter' and l.available_winter)
    )
  order by
    ST_Distance(l.geom, ST_MakePoint(nearby_locations_brief.lng, nearby_locations_brief.lat)::geography) asc,
    l.id asc
  limit nearby_locations_brief.max_results;
$function$;

-- Readable by anyone, like the places it returns. RLS on locations still
-- decides what comes back; this is a STABLE read with no elevated rights.
grant execute on function public.nearby_locations_brief(
  double precision, double precision, integer, text[], text, integer, text
) to anon, authenticated;

-- review_photos had only its primary key, so every lookup of "the photos on
-- this review" was a sequential scan. Harmless at today's size and not at ten
-- thousand reviews — and the place page does this for every review it shows.
create index if not exists review_photos_review_id_idx
  on public.review_photos (review_id);
