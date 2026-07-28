-- Third and last guard from the pre-superuser era that gates on is_admin():
-- 0026's trigger resets almost every column (including status) for anyone who
-- isn't an admin or the verified owner, so a superuser's moderation edit was
-- silently rolled back even though RLS and the status trigger both allowed it.
--
-- Same treatment as 0043/0044: allow the moderation tier, and backend contexts
-- with no auth.uid().
create or replace function restrict_creator_location_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- moderators and the verified owner already have unrestricted edit rights
  -- via the "moderator or verified owner edit location" policy — leave them be.
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
  -- monotonically decreasing: can only go from true to false, never back.
  new.creator_visible := old.creator_visible and new.creator_visible;

  return new;
end;
$$;
