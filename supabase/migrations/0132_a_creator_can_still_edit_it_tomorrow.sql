-- What you added stops being yours after 24 hours, and nothing says so.
--
-- restrict_creator_location_update gives a creator one day to edit what they
-- added. After that the trigger quietly puts every field back: name,
-- description, address, the pin, contact details, opening hours, visibility,
-- the dates an event runs between. It is a BEFORE UPDATE trigger, so the write
-- is permitted, the row is rewritten with the old values, and PostgREST
-- answers 200. Measured on the live database against a row created 40 days
-- ago, as its creator:
--
--   update locations set name = 'PROBE renamed by creator', visibility = 'private'
--   -> reported success; name and visibility both unchanged
--
-- That is the failure mode this repo already has a warning about: the API
-- returns 200 and nothing happened. The app has no way to tell, so it says
-- "Saved" and shows the old row back.
--
-- The window goes. A creator can edit what they wrote for as long as it exists,
-- which is what the owner asked for and what anyone would assume of something
-- they added themselves.
--
-- What stays pinned is unchanged, and is the point of the trigger:
--
--   kind                      an event cannot become a place; the expiry clamp
--                             and starts_at are built on it
--   status, removed_at        moderation state, not the author's
--   avg_rating, review_count  other people's, and maintained by trigger
--   is_verified, is_boosted   claims and paid placement
--   is_claimed, claimed_by    a business claim is decided by a moderator
--   created_by, created_at    authorship and the row's age
--   creator_visible           may be turned off, never back on
--
-- So the widened permission covers what the creator typed, and nothing that
-- was granted to them or earned by others.
--
-- Worth being plain about the trade this makes: a place can now be edited after
-- it has collected reviews, so somebody could build a reputation on one listing
-- and then rewrite it into another. The moderation queue and the audit log in
-- 0128 are what answer that, rather than a deadline that mostly caught honest
-- people fixing a typo the next day.
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

  -- The creator, for as long as the row exists. The `old.created_at > now() -
  -- interval '24 hours'` that used to be part of this condition is what made
  -- every edit after the first day a silent no-op.
  if old.created_by = auth.uid()
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
