-- Reconstructed 2026-10-06 from supabase_migrations.schema_migrations.
--
-- Applied to the live database on 2026-09-03 and never written to a file. The
-- SQL below is the copy Postgres kept, verbatim. See CLAUDE.md.
--
-- ## What it does
--
-- Flattens nearby_locations_brief into a single statement: the two lateral
-- joins pick the primary category and the cover photo per row rather than the
-- function calling out for them, and the distance is computed once in the
-- select and again in the order by rather than wrapped in a subquery.
--
-- It also drops nearby_brief_probe, a scratch function left behind by the work
-- that produced this one. Nothing called it.
--
-- Every parameter reference is qualified — nearby_locations_brief.lng rather
-- than lng. That is not style: this function returns a table whose column names
-- are in scope as identifiers, so an unqualified `lat` or `radius_m` can bind to
-- the wrong thing the moment a column is added with that name, silently. See
-- migration 0077, which is exactly that bug and broke every distance in the app.

drop function if exists public.nearby_brief_probe(double precision, double precision, integer, text[], integer);

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
  id uuid, kind location_kind, name text, description text, address text,
  city text, country text, distance_m double precision, avg_rating numeric,
  review_count integer, category_slug text, category_label text,
  starts_at timestamp with time zone, is_boosted boolean,
  available_summer boolean, available_winter boolean, cover_photo_path text,
  result_lat double precision, result_lng double precision
)
language sql
stable
as $function$
  select
    l.id, l.kind, l.name, l.description, l.address, l.city, l.country,
    ST_Distance(l.geom, ST_MakePoint(nearby_locations_brief.lng, nearby_locations_brief.lat)::geography) as distance_m,
    l.avg_rating, l.review_count,
    primary_category.slug as category_slug,
    primary_category.name as category_label,
    l.starts_at, l.is_boosted, l.available_summer, l.available_winter,
    cover.storage_path as cover_photo_path,
    l.lat as result_lat, l.lng as result_lng
  from public.locations l
  left join lateral (
    select c.slug, c.name from public.location_categories lc
    join public.categories c on c.id = lc.category_id
    where lc.location_id = l.id limit 1
  ) as primary_category on true
  left join lateral (
    select lp.storage_path from public.location_photos lp
    where lp.location_id = l.id
    order by lp.sort_order asc, lp.created_at asc limit 1
  ) as cover on true
  where l.status = 'active'
    and ST_DWithin(l.geom, ST_MakePoint(nearby_locations_brief.lng, nearby_locations_brief.lat)::geography, nearby_locations_brief.radius_m)
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

grant execute on function public.nearby_locations_brief(
  double precision, double precision, integer, text[], text, integer, text
) to anon, authenticated;
