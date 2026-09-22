-- What a partner may actually change, and what stays out of reach.
--
-- A partner (0143) corrects facts on any place: its name, where the pin sits,
-- the address, the phone, the website, the opening hours, the season, whether
-- it costs anything, its photos and its categories. That is the whole job.
--
-- Deliberately not theirs:
--   * anything a person wrote — reviews and other people's photos are
--     untouched here, so a partner reports them like anybody else;
--   * status, so a place cannot be taken off the map by the organisation that
--     would rather not maintain it. Removal is a request an admin answers;
--   * visibility, which is the same thing wearing a different hat;
--   * is_verified and is_boosted, or an account could verify and promote
--     itself, and claimed_by, or it could hand a place to whoever it liked;
--   * creator_visible — the byline belongs to whoever added the place.
--
-- The same list now binds a **verified owner**, who until today got a free pass
-- through this trigger: `return new` with no column pinned. Nothing in the app
-- offered those fields, but the API is the API, and a claimed business could
-- set its own is_verified, is_boosted or status. That was a hole; closing it
-- here costs a claimed owner nothing they could reach from a screen.
--
-- No notification on the grant. notify_on_role_grant fires only for
-- 'superuser', and the app's notification screen renders a role grant with
-- fixed moderator wording — a partner would be told they can now handle
-- reports. A partner account is created and handed over deliberately; the
-- person holding it already knows.

create or replace function public.is_partner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'partner'
  );
$$;

revoke all on function public.is_partner() from public, anon;
grant execute on function public.is_partner() to authenticated, service_role;

/*
 * The guard trigger decides what actually lands; the policy below only decides
 * who gets as far as trying. Both have to know about partners — this trigger
 * reverts silently and reports success, so a partner missing from it would see
 * "saved" and nothing saved (0132 has the story).
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
     or is_moderator() then
    return new;
  end if;

  -- Looks after the place without owning it: a partner anywhere, or the
  -- verified owner of this one. Facts are theirs; the row's standing is not.
  if (is_partner() or (old.claimed_by = auth.uid() and old.is_verified = true))
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
    new.visibility := old.visibility;
    new.import_batch := old.import_batch;
    new.creator_visible := old.creator_visible;
    return new;
  end if;

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

-- The name had stopped describing who it lets through.
alter policy "moderator or verified owner edit location" on locations
  rename to "moderator, partner or verified owner edit location";

alter policy "moderator, partner or verified owner edit location" on locations
  using (
    is_moderator()
    or (
      not is_banned()
      and (is_partner() or (claimed_by = auth.uid() and is_verified = true))
    )
  )
  with check (
    is_moderator()
    or (
      not is_banned()
      and (is_partner() or (claimed_by = auth.uid() and is_verified = true))
    )
  );

-- Photos: a partner may add one and decide which is the cover. Removing
-- somebody else's is still moderator-only, and the DELETE policy above it
-- already says so — a partner deletes only what they uploaded themselves.
drop policy if exists "authenticated users add location photos" on location_photos;
create policy "authenticated users add location photos" on location_photos
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and not is_banned()
    and (
      is_moderator()
      or is_partner()
      or exists (
        select 1 from locations l
        where l.id = location_photos.location_id
          and (l.created_by = auth.uid() or (l.claimed_by = auth.uid() and l.is_verified))
      )
    )
  );

drop policy if exists "owners and moderators order photos" on location_photos;
create policy "owners and moderators order photos" on location_photos
  for update
  using (
    is_moderator()
    or is_partner()
    or exists (
      select 1 from locations l
      where l.id = location_photos.location_id
        and l.claimed_by = auth.uid()
        and l.is_verified
    )
  )
  with check (
    is_moderator()
    or is_partner()
    or exists (
      select 1 from locations l
      where l.id = location_photos.location_id
        and l.claimed_by = auth.uid()
        and l.is_verified
    )
  );

/*
 * Categories, with two fixes alongside the partner.
 *
 * The 24-hour window goes. 0132 dropped it from the location guard so a creator
 * could still fix their own listing next week, but these two policies kept it —
 * so today you can rename your place forever and cannot re-tag it after a day,
 * which is nobody's intended rule.
 *
 * And is_admin() becomes is_moderator(): a superuser can already rename a
 * place, move its pin and remove its photos. Being unable to fix its category
 * was an oversight, not a boundary.
 */
drop policy if exists "location owners tag their own locations" on location_categories;
create policy "location owners tag their own locations" on location_categories
  for all
  using (
    is_moderator()
    or (
      not is_banned()
      and (
        is_partner()
        or exists (
          select 1 from locations l
          where l.id = location_categories.location_id
            and (l.created_by = auth.uid() or (l.claimed_by = auth.uid() and l.is_verified))
        )
      )
    )
  )
  with check (
    is_moderator()
    or (
      not is_banned()
      and (
        is_partner()
        or exists (
          select 1 from locations l
          where l.id = location_categories.location_id
            and (l.created_by = auth.uid() or (l.claimed_by = auth.uid() and l.is_verified))
        )
      )
    )
  );

drop policy if exists "location owners remove their own tags" on location_categories;
create policy "location owners remove their own tags" on location_categories
  for delete
  using (
    is_moderator()
    or (
      not is_banned()
      and (
        is_partner()
        or exists (
          select 1 from locations l
          where l.id = location_categories.location_id
            and (l.created_by = auth.uid() or (l.claimed_by = auth.uid() and l.is_verified))
        )
      )
    )
  );

/*
 * A superuser cannot ban a partner, the same protection superusers and admins
 * already have. A partner account is an organisation the company vouched for;
 * silencing one is a relationship decision, not a moderation call, and it
 * should land on an admin.
 */
drop policy if exists "superusers issue pending bans" on user_bans;
create policy "superusers issue pending bans" on user_bans
  for insert to authenticated
  with check (
    is_moderator()
    and issued_by = auth.uid()
    and (
      is_admin()
      or (
        status = 'pending'
        and not exists (
          select 1 from profiles p
          where p.id = user_bans.user_id
            and p.role in ('partner', 'superuser', 'admin')
        )
      )
    )
  );
