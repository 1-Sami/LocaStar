-- location_categories had select (public) and insert (owner/admin) policies
-- but no delete policy, so RLS silently blocked owners from removing their
-- own category tags when editing a location (delete-then-reinsert hit a
-- unique constraint conflict since the "deleted" rows never actually left).

create policy "location owners remove their own tags" on location_categories
  for delete using (
    is_admin() or exists (
      select 1 from locations
      where locations.id = location_id and locations.created_by = auth.uid()
    )
  );
