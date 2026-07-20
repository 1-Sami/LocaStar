-- Fix: "new row violates row-level security policy for table locations" on
-- every INSERT ... RETURNING (i.e. every location/activity submission).
--
-- The locations SELECT policy called can_view_location(id), which re-queries
-- `locations` by id. Under INSERT ... RETURNING, Postgres evaluates the
-- SELECT policy against the just-inserted row using the command's own
-- snapshot, and a policy that re-queries the table via a separate subquery
-- can't see a row it hasn't committed yet — so the check always failed for
-- brand-new rows, even though the row is legitimately visible a moment
-- later. Inlining the check against the row's own columns (as the previous
-- policy did before 0021) fixes it; the location_shares EXISTS subquery is
-- fine since it hits a different table. can_view_location() itself is left
-- untouched since it's used correctly elsewhere (reviews/photos policies
-- check an existing, different locations row, not the row being inserted).

drop policy "locations are readable based on visibility" on locations;
create policy "locations are readable based on visibility" on locations
  for select using (
    created_by = auth.uid()
    or is_admin()
    or (
      status = 'active'
      and (
        visibility = 'public'
        or exists (
          select 1 from location_shares ls
          where ls.location_id = locations.id and ls.recipient_id = auth.uid()
        )
      )
    )
  );
