-- Superusers are the moderation tier: they handle reports and can hide/flag or
-- remove reported content. Admins keep everything they already had, so
-- is_moderator() covers both roles.
--
-- Deliberately NOT extended to superusers (stays admin-only):
--   * hard-deleting locations       -- removal is done via status, not DELETE
--   * business claim decisions      -- ownership verification is a company call
--   * granting/revoking roles       -- guarded by prevent_self_role_change()
create or replace function is_moderator()
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('superuser', 'admin')
  );
$$;

-- Reports: see them and resolve them.
drop policy "reporters and admins view location reports" on location_reports;
create policy "reporters and moderators view location reports" on location_reports
  for select using (reporter_id = auth.uid() or is_moderator());

drop policy "admins resolve location reports" on location_reports;
create policy "moderators resolve location reports" on location_reports
  for update using (is_moderator()) with check (is_moderator());

drop policy "reporters and admins view reports" on review_reports;
create policy "reporters and moderators view reports" on review_reports
  for select using (reporter_id = auth.uid() or is_moderator());

drop policy "admins resolve reports" on review_reports;
create policy "moderators resolve reports" on review_reports
  for update using (is_moderator()) with check (is_moderator());

-- Reported content: moderators must be able to read it even once hidden or
-- removed, and to change its status.
drop policy "locations are readable based on visibility" on locations;
create policy "locations are readable based on visibility" on locations
  for select using (
    created_by = auth.uid()
    or is_moderator()
    or (
      status = 'active'::location_status
      and publish_at <= now()
      and (
        visibility = 'public'
        or exists (
          select 1 from location_shares ls
          where ls.location_id = locations.id and ls.recipient_id = auth.uid()
        )
      )
    )
  );

drop policy "admin or verified owner edit location" on locations;
create policy "moderator or verified owner edit location" on locations
  for update using (is_moderator() or (claimed_by = auth.uid() and is_verified = true))
  with check (is_moderator() or (claimed_by = auth.uid() and is_verified = true));

drop policy "visible reviews are publicly readable" on reviews;
create policy "visible reviews are publicly readable" on reviews
  for select using (
    is_moderator()
    or user_id = auth.uid()
    or (status = 'visible'::review_status and can_view_location(location_id))
  );

drop policy "users edit own reviews" on reviews;
create policy "users edit own reviews" on reviews
  for update using (user_id = auth.uid() or is_moderator())
  with check (user_id = auth.uid() or is_moderator());

-- Photos attached to reported content.
drop policy "location photos are publicly readable" on location_photos;
create policy "location photos are publicly readable" on location_photos
  for select using (is_moderator() or can_view_location(location_id));

drop policy "review photos are publicly readable" on review_photos;
create policy "review photos are publicly readable" on review_photos
  for select using (
    is_moderator()
    or exists (
      select 1 from reviews r
      where r.id = review_photos.review_id
        and r.status = 'visible'::review_status
        and (can_view_location(r.location_id) or r.user_id = auth.uid())
    )
  );
