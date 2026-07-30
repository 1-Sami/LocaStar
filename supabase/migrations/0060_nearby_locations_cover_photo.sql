-- Cards on Search, Home, Favorites and lists showed a random picsum stock photo
-- for every location, because nearby_locations returned no photo at all and the
-- client filled the gap with placeholderImage(). Adding a location now requires
-- a photo, so people upload one and then never see it anywhere.
--
-- Return the oldest photo as the cover (the first one the submitter chose), so
-- the client can show the real image and fall back to an honest empty state
-- rather than someone else's stock landscape.

drop function if exists public.nearby_locations(
  double precision, double precision, integer, text[], text, text, text
);

create function public.nearby_locations(
  lat double precision,
  lng double precision,
  radius_m integer default 50000,
  category_slugs text[] default null,
  search_query text default null,
  sort text default 'distance',
  season_filter text default null
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
  starts_at timestamptz,
  is_boosted boolean,
  available_summer boolean,
  available_winter boolean,
  cover_photo_path text
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
    ST_Distance(l.geom, ST_MakePoint(lng, lat)::geography) as distance_m,
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
    order by lp.created_at asc
    limit 1
  ) as cover on true
  where l.status = 'active'
    and ST_DWithin(l.geom, ST_MakePoint(lng, lat)::geography, radius_m)
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
    case when sort = 'distance' or sort is null then ST_Distance(l.geom, ST_MakePoint(lng, lat)::geography) end asc;
$function$;

-- The new bidirectional list-share query filters on sender_id as well, which
-- had no index and so sequentially scanned that half.
create index if not exists list_shares_sender_idx on list_shares (sender_id);
