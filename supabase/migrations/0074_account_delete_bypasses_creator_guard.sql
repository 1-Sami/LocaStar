-- Second failure in the same flow, found by finally calling delete_own_account()
-- rather than the delete underneath it:
--
--   23503: insert or update on table "locations" violates foreign key
--          constraint "locations_created_by_fkey"
--
-- 0071 set locations.created_by to ON DELETE SET NULL so contributions outlive
-- the account. Postgres implements that by issuing an UPDATE setting
-- created_by = null — and restrict_creator_location_update() is a BEFORE UPDATE
-- trigger whose whole job is to put pinned columns back:
--
--   new.created_by := old.created_by;
--
-- So the cascade's null was reverted to the id of the profile being deleted,
-- and the foreign key check then failed against a row still pointing at it.
-- The guard was doing exactly what it was written to do; it just had no way to
-- tell a cascade apart from a user editing someone else's location.
--
-- Its existing escape hatches don't cover this. auth.uid() is the person
-- deleting their own account, so it isn't null, and they aren't a moderator.
--
-- Same fix as 0056, which had this identical problem with rating refreshes: a
-- transaction-local flag the guard recognises. Scoped to delete_own_account(),
-- so it cannot be reached from an ordinary update — set_config's third
-- argument is `true`, meaning it lasts for the transaction and no longer.
--
-- This also repairs something 0071 got wrong silently. Its
-- clear_verification_on_owner_delete() runs `update locations set is_verified
-- = false` after the profile goes, and is_verified is another pinned column —
-- so that update was being reverted too, and a location whose verified owner
-- deleted their account would have kept its owner badge. With the flag in
-- place it now actually clears.

create or replace function public.restrict_creator_location_update()
returns trigger
language plpgsql
security definer set search_path to 'public'
as $function$
begin
  if coalesce(current_setting('locastar.rating_refresh', true), 'off') = 'on' then
    return new;
  end if;

  -- An account deletion cascading through. Nulling created_by/claimed_by and
  -- clearing is_verified is the point of that flow, not something to undo.
  if coalesce(current_setting('locastar.account_delete', true), 'off') = 'on' then
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

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in';
  end if;

  -- Transaction-local, so it is gone the moment this call ends.
  perform set_config('locastar.account_delete', 'on', true);

  delete from auth.users where id = me;
end;
$$;
