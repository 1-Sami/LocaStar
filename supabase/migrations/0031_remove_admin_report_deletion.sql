-- Admins can no longer permanently delete handled reports/claims — the
-- "Handled" list is a permanent record now, not something to be cleared.
drop policy if exists "admins delete location reports" on location_reports;
drop policy if exists "admins delete review reports" on review_reports;
drop policy if exists "admins delete business claims" on business_claims;
