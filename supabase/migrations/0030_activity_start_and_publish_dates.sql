-- Time-based activities: an explicit start date, and an independent
-- scheduled "publish" date (when the listing actually becomes visible,
-- which can differ from when the activity itself starts).
alter table locations add column if not exists starts_at timestamptz;
alter table locations add column if not exists publish_at timestamptz not null default now();

create index if not exists locations_publish_at_idx on locations (publish_at);

-- A not-yet-published row (publish_at in the future) is only visible to its
-- creator and admins — same treatment a 'pending' status row already gets.
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
          and l.publish_at <= now()
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

drop policy "locations are readable based on visibility" on locations;
create policy "locations are readable based on visibility" on locations
  for select using (
    created_by = auth.uid()
    or is_admin()
    or (
      status = 'active'
      and publish_at <= now()
      and (
        visibility = 'public'
        or exists (
          select 1 from location_shares ls
          where ls.location_id = locations.id and ls.recipient_id = auth.uid()
        )
      )
    )
  );

-- The 120-day auto-expiry window now runs from the chosen start date
-- (falling back to submission time if no start date was set), instead of
-- always running from submission time.
create or replace function clamp_activity_expiry()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  base timestamptz;
begin
  if new.kind = 'activity' and not coalesce(new.is_boosted, false) then
    base := coalesce(new.starts_at, new.created_at);
    if new.expires_at is null or new.expires_at > base + interval '120 days' then
      new.expires_at := base + interval '120 days';
    end if;
  end if;
  return new;
end;
$$;
