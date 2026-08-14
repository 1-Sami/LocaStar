-- Pin city and country alongside the address they describe.
--
-- restrict_creator_location_update() reverts the columns an out-of-window
-- creator may not change. It pins name, description, address and geom — but
-- city and country were never in the list, because until now nothing could
-- write them after creation.
--
-- Editing a place can write them now: dragging the pin re-geocodes, and the
-- new city and country go with the save. Without this the guard would revert
-- the address and the coordinates while letting the city through, leaving a
-- row whose city contradicts its own address and its own position — and
-- silently, because this trigger reverts rather than raising, so the API
-- answers 200 and the app reports success either way.
--
-- Only the restrictive branch changes. The creator's 24-hour branch is
-- deliberately left alone: it already allows address and geom to move, so the
-- city has to be allowed to follow them.
--
-- Everything else in the function is reproduced unchanged. CREATE OR REPLACE
-- takes the whole body, and there is no way to append to one line of it.

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
