-- A creator could not fix their own typo. The guard pinned name, description,
-- address, geom, hours and contact details for anyone who is not a moderator or
-- a verified owner, so a misspelled name or a wrong street was permanent and had
-- to come to us. Item [11] in REVIEW-NOTES.md.
--
-- The decision: a 24-hour window from creation, and then it closes for good.
-- Long enough to fix what you got wrong while you still remember adding it;
-- short enough that a location cannot be quietly rewritten months later because
-- the creator fell out with the place.
--
-- IMPORTANT -- why this is not just another clause on the early `return new`.
-- That branch allows *every* column. Adding creators to it would hand anyone who
-- adds a location 24 hours of write access to is_verified, is_boosted, status,
-- claimed_by and avg_rating: self-verification, free paid placement, un-hiding
-- their own removed content, and inventing a rating. So the window gets its own
-- branch that allows the content columns and pins everything that is not the
-- creator's to decide.
--
-- Not in the window: `kind`. Switching a place to an activity mid-life leaves
-- phone/website on something that wants dates, or vice versa.
--
-- Banned users get nothing, matching every other write path.

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
    new.is_claimed := old.is_claimed;
    new.claimed_by := old.claimed_by;
    new.status := old.status;
    new.avg_rating := old.avg_rating;
    new.review_count := old.review_count;
    new.google_place_id := old.google_place_id;
    new.is_verified := old.is_verified;
    new.is_boosted := old.is_boosted;
    -- One-way, as before: credit once hidden stays hidden.
    new.creator_visible := old.creator_visible and new.creator_visible;
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

-- Categories were the hole in the same wall. This policy let a creator retag
-- their location forever, with no time limit at all, which would have made the
-- window meaningless: the Edit button disappears after a day but the REST API
-- still accepts a retag. Same 24 hours, same reasoning.
--
-- Safe to tighten: the only callers are add-location (a brand-new row, trivially
-- inside the window) and edit-location (now gated by the same rule).
drop policy if exists "location owners tag their own locations" on public.location_categories;
create policy "location owners tag their own locations" on public.location_categories
  for all
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
  )
  with check (
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

comment on function public.restrict_creator_location_update is
  'Column-level guard for locations. Moderators and verified owners may change
   anything. The creator gets 24 hours from created_at to correct the content
   they entered, but never status, verification, boost, ownership or the derived
   rating columns. After that, content is pinned.';
