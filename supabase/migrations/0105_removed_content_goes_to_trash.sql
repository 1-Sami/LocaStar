-- Removal becomes reversible for thirty days.
--
-- There were two moderator actions with one honest difference between them:
-- Hide meant "down while I think", Remove meant "gone". That forced a
-- certainty judgement at the moment of acting, which is the wrong moment —
-- certainty is what you have after looking, not before. One action with a
-- window gives the same safety without the decision.
--
-- It also closes something Hide never did. Hidden content stayed hidden
-- indefinitely with nothing prompting anyone to revisit it; there is one such
-- review in this database right now. A countdown ends by itself.
--
-- Nothing here deletes anything. This migration only records *when* something
-- was removed; the job that acts on that lives separately, because an
-- unattended process that destroys real data deserves its own review.

alter table public.locations       add column if not exists removed_at timestamptz;
alter table public.reviews         add column if not exists removed_at timestamptz;
alter table public.location_photos add column if not exists removed_at timestamptz;
alter table public.review_photos   add column if not exists removed_at timestamptz;

comment on column public.locations.removed_at is
  'When a moderator removed it. The purge job deletes rows removed longer ago than the retention window. Null means not removed.';
comment on column public.reviews.removed_at is
  'When a moderator removed it. See locations.removed_at.';
comment on column public.location_photos.removed_at is
  'When a moderator removed it. Distinct from hidden_at, which is the temporary hold while a report is open.';
comment on column public.review_photos.removed_at is
  'When a moderator removed it. See location_photos.removed_at.';

-- Backfill: content already removed under the old rules starts its clock now,
-- not at some unknown past date, so nothing is destroyed for having been
-- removed before the window existed.
update public.locations set removed_at = now() where status = 'removed' and removed_at is null;
update public.reviews   set removed_at = now() where status = 'removed' and removed_at is null;

/*
 * Photo removal and restoration, moderators only.
 *
 * Same reasoning as release_photo_hold: location_photos already lets its
 * uploader update the row, so doing this through a policy would let somebody
 * put their own photo beyond a moderator's reach — or pull it back out of the
 * trash. review_photos allows no updates at all.
 */
create or replace function public.set_photo_removed(
  p_location_photo_id uuid default null,
  p_review_photo_id uuid default null,
  p_removed boolean default true
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  stamp timestamptz := case when p_removed then now() else null end;
begin
  if not is_moderator() then
    raise exception 'Not allowed';
  end if;

  if p_location_photo_id is not null then
    -- Removing settles the report's hold as well: the photo is out of sight
    -- either way, and leaving hidden_at set would keep it "pending review"
    -- forever in anything that reads that column.
    update location_photos
       set removed_at = stamp, hidden_at = null
     where id = p_location_photo_id;
  end if;
  if p_review_photo_id is not null then
    update review_photos
       set removed_at = stamp, hidden_at = null
     where id = p_review_photo_id;
  end if;
end;
$function$;

revoke all on function public.set_photo_removed(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_photo_removed(uuid, uuid, boolean) to authenticated;

/*
 * Pin removed_at in the creator guard, for the same reason city and country
 * were pinned in 0102.
 *
 * Without this an out-of-window creator could set removed_at on their own
 * listing while the guard reverted the status — harmless on its own, but the
 * purge would then be looking at a row that says it was removed when nobody
 * removed it. The purge also requires status = 'removed' precisely so that one
 * stray column cannot destroy anything, but two locks are right for a job that
 * deletes.
 */
create or replace function public.restrict_creator_location_update()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if coalesce(current_setting('locastar.rating_refresh', true), 'off') = 'on' then
    return new;
  end if;

  if coalesce(current_setting('locastar.account_delete', true), 'off') = 'on' then
    return new;
  end if;

  if auth.uid() is null
     or is_moderator()
     or (old.claimed_by = auth.uid() and old.is_verified = true) then
    return new;
  end if;

  if old.created_by = auth.uid()
     and old.created_at > now() - interval '24 hours'
     and not is_banned() then
    new.kind := old.kind;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.is_claimed := old.is_claimed;
    new.claimed_by := old.claimed_by;
    new.status := old.status;
    new.removed_at := old.removed_at;
    new.avg_rating := old.avg_rating;
    new.review_count := old.review_count;
    new.google_place_id := old.google_place_id;
    new.is_verified := old.is_verified;
    new.is_boosted := old.is_boosted;
    new.creator_visible := old.creator_visible and new.creator_visible;
    return new;
  end if;

  new.kind := old.kind;
  new.name := old.name;
  new.description := old.description;
  new.address := old.address;
  new.city := old.city;
  new.country := old.country;
  new.geom := old.geom;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.is_claimed := old.is_claimed;
  new.claimed_by := old.claimed_by;
  new.phone := old.phone;
  new.email := old.email;
  new.website := old.website;
  new.hours := old.hours;
  new.status := old.status;
  new.removed_at := old.removed_at;
  new.avg_rating := old.avg_rating;
  new.review_count := old.review_count;
  new.google_place_id := old.google_place_id;
  new.is_verified := old.is_verified;
  new.visibility := old.visibility;
  new.expires_at := old.expires_at;
  new.is_boosted := old.is_boosted;
  new.other_category_detail := old.other_category_detail;
  new.hours_not_applicable := old.hours_not_applicable;
  new.creator_visible := old.creator_visible and new.creator_visible;

  return new;
end;
$function$;
