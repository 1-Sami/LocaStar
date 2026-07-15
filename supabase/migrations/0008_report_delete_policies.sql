-- Admins need to permanently delete handled reports (the "Handled" box is
-- cleared explicitly, not automatically) but no delete policy existed yet
-- on either report table.

create policy "admins delete location reports" on location_reports
  for delete using (is_admin());

create policy "admins delete review reports" on review_reports
  for delete using (is_admin());
