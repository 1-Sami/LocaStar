-- LocaStar core schema: profiles, locations (places + activities), reviews,
-- saves (favorites/bucket list), lists, sharing, notifications, business claims.

create extension if not exists postgis;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type user_role as enum ('user', 'admin');
create type location_kind as enum ('place', 'activity');
create type location_status as enum ('pending', 'active', 'flagged', 'removed');
create type review_status as enum ('visible', 'hidden', 'removed');
create type report_status as enum ('open', 'reviewed', 'actioned', 'dismissed');
create type save_kind as enum ('favorite', 'bucket_list');
create type claim_status as enum ('pending', 'approved', 'rejected');

-- ---------------------------------------------------------------------------
-- profiles (mirrors auth.users)
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  bio text,
  role user_role not null default 'user',
  locale text not null default 'en',
  theme_preference text not null default 'system',
  created_at timestamptz not null default now()
);

create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  icon text,
  parent_id uuid references categories (id)
);

-- ---------------------------------------------------------------------------
-- locations (unified "place" and "activity" entity)
-- ---------------------------------------------------------------------------

create table locations (
  id uuid primary key default gen_random_uuid(),
  kind location_kind not null default 'place',
  name text not null,
  description text,
  address text,
  geom geography(Point, 4326) not null,
  created_by uuid references profiles (id),
  is_claimed boolean not null default false,
  claimed_by uuid references profiles (id),
  phone text,
  email text,
  website text,
  hours jsonb,
  status location_status not null default 'pending',
  avg_rating numeric(2, 1) not null default 0,
  review_count integer not null default 0,
  google_place_id text,
  search_text tsvector
    generated always as (
      to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(address, ''))
    ) stored,
  created_at timestamptz not null default now()
);

-- Load-bearing index: every "nearby" / distance-sort / radius query depends on this.
create index locations_geom_idx on locations using gist (geom);
create index locations_search_text_idx on locations using gin (search_text);
create index locations_name_trgm_idx on locations using gin (name gin_trgm_ops);
create index locations_status_idx on locations (status);

create table location_categories (
  location_id uuid not null references locations (id) on delete cascade,
  category_id uuid not null references categories (id) on delete cascade,
  primary key (location_id, category_id)
);

create table location_photos (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations (id) on delete cascade,
  user_id uuid references profiles (id),
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------

create table reviews (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  title text,
  body text,
  like_count integer not null default 0,
  report_count integer not null default 0,
  status review_status not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, user_id)
);

create index reviews_location_id_idx on reviews (location_id);

create table review_photos (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews (id) on delete cascade,
  storage_path text not null
);

create table review_likes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (review_id, user_id)
);

create table review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews (id) on delete cascade,
  reporter_id uuid not null references profiles (id),
  reason text not null,
  details text,
  status report_status not null default 'open',
  resolved_by uuid references profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- Keep locations.avg_rating / review_count in sync with visible reviews.
create function refresh_location_rating()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  target_location_id uuid := coalesce(new.location_id, old.location_id);
begin
  update locations
  set
    avg_rating = coalesce((
      select round(avg(rating)::numeric, 1)
      from reviews
      where location_id = target_location_id and status = 'visible'
    ), 0),
    review_count = (
      select count(*) from reviews
      where location_id = target_location_id and status = 'visible'
    )
  where id = target_location_id;
  return null;
end;
$$;

create trigger reviews_refresh_rating
  after insert or update or delete on reviews
  for each row execute function refresh_location_rating();

-- ---------------------------------------------------------------------------
-- saves (favorites + bucket list, one table with a `kind` discriminator)
-- ---------------------------------------------------------------------------

create table saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  location_id uuid not null references locations (id) on delete cascade,
  kind save_kind not null,
  created_at timestamptz not null default now(),
  unique (user_id, location_id, kind)
);

-- ---------------------------------------------------------------------------
-- lists (personal lists, private-only for MVP; is_public reserved for later)
-- ---------------------------------------------------------------------------

create table lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  description text,
  is_public boolean not null default false,
  cover_image text,
  created_at timestamptz not null default now()
);

create table list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references lists (id) on delete cascade,
  location_id uuid not null references locations (id) on delete cascade,
  note text,
  added_at timestamptz not null default now(),
  unique (list_id, location_id)
);

-- ---------------------------------------------------------------------------
-- location_shares (share-to-a-person + optional one-off note)
-- ---------------------------------------------------------------------------

create table location_shares (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations (id) on delete cascade,
  sender_id uuid not null references profiles (id) on delete cascade,
  recipient_id uuid not null references profiles (id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

create index location_shares_recipient_idx on location_shares (recipient_id);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on notifications (user_id);

-- ---------------------------------------------------------------------------
-- business_claims (schema stub for later business-portal features)
-- ---------------------------------------------------------------------------

create table business_claims (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  status claim_status not null default 'pending',
  verification_notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- nearby_locations RPC: the core geo-query every discovery/search screen uses.
-- ---------------------------------------------------------------------------

create function nearby_locations(
  lat double precision,
  lng double precision,
  radius_m integer default 50000,
  category_slug text default null,
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
  review_count integer
)
language sql
stable
as $$
  select
    l.id,
    l.kind,
    l.name,
    l.description,
    l.address,
    ST_Distance(l.geom, ST_MakePoint(lng, lat)::geography) as distance_m,
    l.avg_rating,
    l.review_count
  from locations l
  where l.status = 'active'
    and ST_DWithin(l.geom, ST_MakePoint(lng, lat)::geography, radius_m)
    and (
      category_slug is null
      or exists (
        select 1 from location_categories lc
        join categories c on c.id = lc.category_id
        where lc.location_id = l.id and c.slug = category_slug
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
