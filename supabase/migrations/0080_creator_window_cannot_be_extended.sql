-- Two holes in 0079, both found by probing it rather than reading it.
--
-- 1. THE WINDOW COULD EXTEND ITSELF. 0079 keys the grace period off
--    locations.created_at but never pinned that column, in either branch. So:
--
--      update locations set created_at = now() + interval '10 years'
--
--    from inside the window bought a permanent one, and the same statement from
--    *outside* it re-opened a window that had already closed, because the
--    catch-all branch does not pin created_at either (it never did -- 0079 only
--    made it reachable). A guard whose own key is writable by the person it
--    guards is not a guard. Pinned in both branches now.
--
-- 2. A SECOND PERMISSIVE POLICY MADE THE CATEGORY LIMIT DECORATIVE.
--    0079 tightened "location owners tag their own locations" to 24 hours, but
--    "location owners remove their own tags" was still there from an earlier
--    migration, granting DELETE to any creator with no time limit. Permissive
--    policies OR together, so the tighter rule was simply skipped for DELETE:
--    a creator could still strip every category off a location years later,
--    which drops it out of every filter and every category browse. Probed: the
--    delete succeeded 25 hours after creation.
--
-- Nothing legitimately needs a creator to write created_at, and the delete rule
-- now matches the insert rule it was always meant to mirror.

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

  -- The creator's grace window: fix what you typed, nothing else.
  if old.created_by = auth.uid()
     and old.created_at > now() - interval '24 hours'
     and not is_banned() then
    new.kind := old.kind;
    new.created_by := old.created_by;
    -- The window's own key. Writable by the creator, this buys a permanent one.
    new.created_at := old.created_at;
    new.is_claimed := old.is_claimed;
    new.claimed_by := old.claimed_by;
    new.status := old.status;
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
  new.geom := old.geom;
  new.created_by := old.created_by;
  -- Without this, a closed window could be re-opened with created_at = now().
  new.created_at := old.created_at;
  new.is_claimed := old.is_claimed;
  new.claimed_by := old.claimed_by;
  new.phone := old.phone;
  new.email := old.email;
  new.website := old.website;
  new.hours := old.hours;
  new.status := old.status;
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

drop policy if exists "location owners remove their own tags" on public.location_categories;
create policy "location owners remove their own tags" on public.location_categories
  for delete
  using (
    is_admin()
    or (
      not is_banned()
      and exists (
        select 1 from locations l
        where l.id = location_categories.location_id
          and (
            (l.created_by = auth.uid() and l.created_at > now() - interval '24 hours')
            or (l.claimed_by = auth.uid() and l.is_verified)
          )
      )
    )
  );
