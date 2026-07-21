-- Let the original creator remove their own "Added by" credit (a one-way
-- action, per the app's confirmation warning) even though migration 0026
-- took away their general edit access. A dedicated, narrow policy plus a
-- trigger (same pattern as 0010's prevent_owner_status_change) makes sure
-- this can only ever flip creator_visible from true to false and cannot be
-- used as a backdoor to edit any other column.

create policy "creator can hide own credit" on locations
  for update using (
    created_by = auth.uid()
  ) with check (
    created_by = auth.uid()
  );

create or replace function restrict_creator_location_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- admins and the verified owner already have unrestricted edit rights
  -- via the "admin or verified owner edit location" policy — leave them be.
  if is_admin() or (old.claimed_by = auth.uid() and old.is_verified = true) then
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
  -- monotonically decreasing: can only go from true to false, never back.
  new.creator_visible := old.creator_visible and new.creator_visible;

  return new;
end;
$$;

create trigger locations_restrict_creator_update
  before update on locations
  for each row execute function restrict_creator_location_update();
