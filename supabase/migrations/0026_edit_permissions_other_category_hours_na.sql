-- 1. Only admins and the verified owner (claimed_by, once the business
--    claim is approved) may edit a location — the original creator no
--    longer keeps standing edit access.
drop policy "owners edit own locations" on locations;
create policy "admin or verified owner edit location" on locations
  for update using (
    is_admin() or (claimed_by = auth.uid() and is_verified = true)
  ) with check (
    is_admin() or (claimed_by = auth.uid() and is_verified = true)
  );

-- 2. Free-text detail captured when a submitter picks the "Other" category,
-- for internal stats only (not shown publicly).
alter table locations add column if not exists other_category_detail text;

-- 3. Let a submitter mark that a location genuinely has no opening hours to
-- state (e.g. always-open public property), distinct from "not specified".
alter table locations add column if not exists hours_not_applicable boolean not null default false;
