-- Leaving a review recalculates locations.avg_rating / review_count through the
-- reviews_refresh_rating trigger. That UPDATE then fires the BEFORE trigger
-- restrict_creator_location_update, which pins avg_rating and review_count back
-- to their old values for anyone who is not a moderator or the verified owner.
--
-- So a normal user's review never moved the rating: the write succeeded, no
-- error was raised, and the value silently stayed put. Reviews left by an admin
-- did update it (moderators get an early return), which is why only some
-- locations looked wrong.
--
-- The guard still has to stop a creator from writing their own rating by hand,
-- so we can't simply drop those two lines. Instead the refresh marks itself as a
-- system update with a transaction-local flag, and the guard honours it. The
-- flag can only be set from inside the refresh function: it is a trigger
-- function, so it cannot be invoked over the REST API, and set_config lives in
-- pg_catalog which PostgREST does not expose.

create or replace function public.refresh_location_rating()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  target_location_id uuid := coalesce(new.location_id, old.location_id);
begin
  perform set_config('locastar.rating_refresh', 'on', true);

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

  perform set_config('locastar.rating_refresh', 'off', true);
  return null;
end;
$function$;

create or replace function public.restrict_creator_location_update()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Rating/review-count refresh is a system update, not a creator edit.
  if coalesce(current_setting('locastar.rating_refresh', true), 'off') = 'on' then
    return new;
  end if;

  if auth.uid() is null
     or is_moderator()
     or (old.claimed_by = auth.uid() and old.is_verified = true) then
    return new;
  end if;

  new.kind := old.kind;
  new.name := old.name;
  new.description := old.description;
  new.address := old.address;
  new.geom := old.geom;
  new.created_by := old.created_by;
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

-- Repair the rows the bug left stale. auth.uid() is null in a migration, so the
-- guard returns early and this write lands.
update locations l
set
  avg_rating = coalesce((
    select round(avg(r.rating)::numeric, 1)
    from reviews r where r.location_id = l.id and r.status = 'visible'
  ), 0),
  review_count = (
    select count(*) from reviews r where r.location_id = l.id and r.status = 'visible'
  );
