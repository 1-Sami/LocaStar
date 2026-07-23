-- Surface an activity's start date in the nearby/search list so users can
-- see it without opening the location (the detail page already shows it).
drop function if exists nearby_locations(double precision, double precision, integer, text[], text, text);

create function nearby_locations(
  lat double precision,
  lng double precision,
  radius_m integer default 50000,
  category_slugs text[] default null,
  search_query text default null,
  sort text default 'distance'
)
returns table (
  id uuid,
  kind location_kind,
  name text,
  description text,
  address text,
  distance_m double precision,
  avg_rating numeric,
  review_count integer,
  category_slug text,
  category_label text,
  starts_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select
    l.id,
    l.kind,
    l.name,
    l.description,
    l.address,
    ST_Distance(l.geom, ST_MakePoint(lng, lat)::geography) as distance_m,
    l.avg_rating,
    l.review_count,
    primary_category.slug as category_slug,
    primary_category.name as category_label,
    l.starts_at
  from locations l
  left join lateral (
    select c.slug, c.name
    from location_categories lc
    join categories c on c.id = lc.category_id
    where lc.location_id = l.id
    limit 1
  ) as primary_category on true
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
  order by
    case when sort = 'rating' then l.avg_rating end desc,
    case when sort = 'distance' or sort is null then ST_Distance(l.geom, ST_MakePoint(lng, lat)::geography) end asc;
$$;
