-- Narrow what 0122 opened.
--
-- That migration gave moderators read of every list, copying the shape 0042
-- used for locations. Locations are public things; a private list is not. It
-- is somebody's own shortlist of places, visible to nobody, and there was no
-- reason for a moderator to be able to read one that nobody had complained
-- about.
--
-- The need is narrower than the grant was: a moderator has to be able to read
-- a list *that has been reported*, including if the owner makes it private
-- after the fact to take the evidence away. That is exactly what this says,
-- and nothing more.

drop policy if exists "moderators read every list" on lists;

create policy "moderators read reported lists" on lists
  for select using (
    is_moderator()
    and exists (select 1 from list_reports where list_reports.list_id = lists.id)
  );
