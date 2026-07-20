-- Private activities (visible only to the creator + explicitly shared
-- users), activity auto-expiry (120-day cap unless boosted), and an
-- admin-only location delete capability.

alter table locations add column if not exists visibility text not null default 'public'
  check (visibility in ('public', 'private'));
alter table locations add column if not exists expires_at timestamptz;
alter table locations add column if not exists is_boosted boolean not null default false;

create index if not exists locations_expires_at_idx on locations (expires_at) where expires_at is not null;

-- Central "can I see this location" check, reused by locations itself and
-- by its reviews/photos so a private activity doesn't leak through them.
create or replace function can_view_location(target_location_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from locations l
    where l.id = target_location_id
      and (
        l.created_by = auth.uid()
        or is_admin()
        or (
          l.status = 'active'
          and (
            l.visibility = 'public'
            or exists (
              select 1 from location_shares ls
              where ls.location_id = l.id and ls.recipient_id = auth.uid()
            )
          )
        )
      )
  );
$$;

drop policy "active locations are publicly readable" on locations;
create policy "locations are readable based on visibility" on locations
  for select using (can_view_location(id));

create policy "admins delete locations" on locations
  for delete using (is_admin());

-- Only a private location's creator may share it; public locations can
-- still be shared by anyone (unchanged from prior behavior).
drop policy "users send shares as themselves" on location_shares;
create policy "users send shares as themselves" on location_shares
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from locations l
      where l.id = location_shares.location_id
        and (l.visibility = 'public' or l.created_by = auth.uid())
    )
  );

drop policy "visible reviews are publicly readable" on reviews;
create policy "visible reviews are publicly readable" on reviews
  for select using (
    is_admin()
    or user_id = auth.uid()
    or (status = 'visible' and can_view_location(location_id))
  );

drop policy "location photos are publicly readable" on location_photos;
create policy "location photos are publicly readable" on location_photos
  for select using (
    is_admin()
    or can_view_location(location_id)
  );

drop policy "review photos are publicly readable" on review_photos;
create policy "review photos are publicly readable" on review_photos
  for select using (
    is_admin()
    or exists (
      select 1 from reviews r
      where r.id = review_photos.review_id
        and r.status = 'visible'
        and (can_view_location(r.location_id) or r.user_id = auth.uid())
    )
  );

-- Activities always expire within 120 days unless boosted (boosting isn't
-- implemented yet, so this currently applies to every activity).
create or replace function clamp_activity_expiry()
returns trigger
language plpgsql
as $$
begin
  if new.kind = 'activity' and not coalesce(new.is_boosted, false) then
    if new.expires_at is null or new.expires_at > new.created_at + interval '120 days' then
      new.expires_at := new.created_at + interval '120 days';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists clamp_activity_expiry_trigger on locations;
create trigger clamp_activity_expiry_trigger
  before insert or update on locations
  for each row execute function clamp_activity_expiry();
