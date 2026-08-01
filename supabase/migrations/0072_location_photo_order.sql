-- The photo you see first on a location was whichever happened to be uploaded
-- first (0060 picks the oldest by created_at). That is arbitrary: the first
-- photo of a place is rarely the one that best shows it.
--
-- No automatic rule fixes this. Ranking by likes was considered and rejected —
-- location_photos has no likes to rank by (only reviews and lists do, so it
-- would mean building a whole feature first), and even then "most liked"
-- measures popularity rather than how well a photo explains a place. The plain
-- wide shot that actually tells you what you are looking at is not usually the
-- one people heart.
--
-- So someone chooses. sort_order defaults to 0 for every existing and future
-- photo, which leaves today's oldest-first behaviour exactly as it is until
-- somebody deliberately promotes a photo.

alter table location_photos add column if not exists sort_order integer not null default 0;

comment on column location_photos.sort_order is
  'Lower sorts first. Ties fall back to created_at, so untouched photos keep upload order.';

-- Matches the cover lookup below and the detail-screen ordering.
create index if not exists location_photos_order_idx
  on location_photos (location_id, sort_order, created_at);

-- Who can reorder: moderators, and the verified owner of the location. Not the
-- creator — adding a place doesn't make it yours — and not the uploader of an
-- individual photo, which would let anyone who uploads promote their own shot
-- to the top of a business they have nothing to do with.
--
-- location_photos had no UPDATE policy at all, so this is additive: nobody
-- could update a photo row before.
drop policy if exists "owners and moderators order photos" on location_photos;
create policy "owners and moderators order photos" on location_photos
  for update
  using (
    is_moderator()
    or exists (
      select 1 from locations l
      where l.id = location_photos.location_id
        and l.claimed_by = auth.uid()
        and l.is_verified
    )
  )
  with check (
    is_moderator()
    or exists (
      select 1 from locations l
      where l.id = location_photos.location_id
        and l.claimed_by = auth.uid()
        and l.is_verified
    )
  );

-- Recreated verbatim from the live definition with one change: the cover
-- lateral now orders by sort_order before created_at.
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
    order by lp.sort_order asc, lp.created_at asc
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
