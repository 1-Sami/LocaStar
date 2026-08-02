-- Anyone signed in could attach a photo to anyone's location.
--
-- The INSERT policy on location_photos was:
--
--     with check (auth.uid() = user_id and not is_banned())
--
-- which checks that you claim the photo as your own, and nothing at all about
-- the location it is being attached to. location_id is a plain uuid on the
-- row, so any unbanned account could point one at any location in the app.
--
-- Nothing in the app does this -- addLocationPhoto is called from exactly one
-- place, while creating a location, and there is no screen for adding a photo
-- to an existing one. But the app is not the only way in. The anon key ships
-- inside every copy of the APK and the web bundle, by design, so the REST API
-- is reachable by anyone who signs up and skips the client. RLS is the only
-- thing standing there, and here it was not standing.
--
-- Compare review_photos, which has had this right all along: its INSERT policy
-- requires the review to belong to the caller. Same shape of problem, opposite
-- outcome, one table apart.
--
-- Tightened to match what the app actually permits today: the person who
-- created the location, the verified owner who claimed it, and moderators.
-- This removes no working behaviour. If community photo contributions are
-- wanted later, widen this deliberately rather than inheriting it by accident.

alter policy "authenticated users add location photos" on public.location_photos
  with check (
    auth.uid() = user_id
    and not is_banned()
    and (
      is_moderator()
      or exists (
        select 1
        from locations l
        where l.id = location_photos.location_id
          and (
            l.created_by = auth.uid()
            or (l.claimed_by = auth.uid() and l.is_verified)
          )
      )
    )
  );
