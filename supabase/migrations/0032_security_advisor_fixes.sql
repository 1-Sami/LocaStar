-- NOTE: the Supabase scanner's "RLS disabled in public" alert on
-- spatial_ref_sys is NOT fixed here. It's a built-in PostGIS reference table
-- (coordinate-system definitions, no app/user data) owned by the
-- `supabase_admin` role, not the role migrations run as — attempting
-- `alter table` on it fails with "must be owner of table spatial_ref_sys".
-- This is a well-known false positive that every PostGIS-enabled Supabase
-- project's linter flags; it cannot be fixed from the project side and is
-- safe to leave as-is (see the investigation notes in this migration's
-- accompanying commit/PR description).

-- search_share_candidates() searches profiles by username/email and is only
-- ever called by the app while a user is signed in (friend search, location
-- share, list share). It was also callable by anonymous/unauthenticated
-- callers via the default PUBLIC execute grant Postgres applies to new
-- functions, which would let an unauthenticated caller enumerate registered
-- usernames/emails. Restrict it to signed-in users only.
revoke execute on function search_share_candidates(text, uuid) from public;
revoke execute on function search_share_candidates(text, uuid) from anon;
grant execute on function search_share_candidates(text, uuid) to authenticated;

-- Pin search_path on nearby_locations for consistency with the rest of the
-- schema's functions (defends against search_path hijacking).
create or replace function nearby_locations(
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
  category_label text
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
    primary_category.name as category_label
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
