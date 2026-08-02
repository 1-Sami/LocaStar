-- Moderators had the power to remove content but no way to reach it, and the
-- delete policies stopped at admin.
--
-- Two separate problems, both reported as "I have to go through the report
-- screen to take down a bad photo".
--
-- 1. Reviews were already fine at the database level: the UPDATE policy allows
--    is_moderator() to set status, and log_review_status_change() writes every
--    change to moderation_actions. Nothing here needs to change for them --
--    the gap is entirely in the UI, which only offered the action from the
--    reports screen. Deliberately NOT switching reviews to a hard delete:
--    'removed' is reversible and leaves a record that the thing existed, and
--    destroying the evidence of a harmful comment is the wrong default for
--    moderation.
--
-- 2. Photos have no status column, so deletion is the only lever, and both
--    delete policies were gated on is_admin(). A superuser -- the whole point
--    of which is handling exactly this -- could not remove an image at all.
--    Widened to is_moderator(), which is role in ('superuser','admin').
--
-- Also adds lat/lng, because the location screen had no coordinates and so
-- could not tell anyone how far away a place is. nearby_locations returns
-- distance_m for the search results, but opening a location directly -- from a
-- share link, say -- goes through a plain select that has only geom, which
-- PostgREST hands back as an opaque geography. Generated columns keep them in
-- step with geom for free and are immutable, so they cost nothing to maintain.

alter policy "users manage own location photos" on public.location_photos
  using ((auth.uid() = user_id) or is_moderator());

alter policy "review authors delete review photos" on public.review_photos
  using (
    is_moderator()
    or exists (
      select 1 from reviews
      where reviews.id = review_photos.review_id
        and reviews.user_id = auth.uid()
    )
  );

-- A deleted photo leaves nothing behind, so unlike a status change it needs
-- the audit row written explicitly. Only moderator deletions are logged:
-- someone tidying up their own upload is not a moderation action.
-- The two photo tables do not have the same shape: location_photos records the
-- uploader in user_id, review_photos has only (id, review_id, storage_path)
-- and inherits its owner from the review. Reading old.user_id directly
-- compiles fine and then throws at runtime on review_photos, which would break
-- review authors deleting their own photos -- so go through to_jsonb, which
-- yields null for a column that isn't there, and resolve the author instead.
create or replace function public.log_photo_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_json jsonb := to_jsonb(old);
  uploader uuid := (row_json->>'user_id')::uuid;
begin
  if uploader is null and row_json ? 'review_id' then
    select r.user_id into uploader
    from reviews r
    where r.id = (row_json->>'review_id')::uuid;
  end if;

  if is_moderator() and uploader is distinct from auth.uid() then
    insert into moderation_actions (actor_id, actor_role, action, target_type, target_id, detail)
    values (
      auth.uid(),
      current_user_role(),
      'photo_deleted',
      tg_argv[0],
      old.id,
      jsonb_build_object('storage_path', old.storage_path, 'uploader_id', uploader)
    );
  end if;
  return old;
end;
$$;

drop trigger if exists location_photos_log_delete on public.location_photos;
create trigger location_photos_log_delete
before delete on public.location_photos
for each row execute function public.log_photo_deleted('location_photo');

drop trigger if exists review_photos_log_delete on public.review_photos;
create trigger review_photos_log_delete
before delete on public.review_photos
for each row execute function public.log_photo_deleted('review_photo');

alter table public.locations
  add column if not exists lat double precision
    generated always as (st_y(geom::geometry)) stored,
  add column if not exists lng double precision
    generated always as (st_x(geom::geometry)) stored;
