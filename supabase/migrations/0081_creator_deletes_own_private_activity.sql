-- Deleting a location was admin-only, which is right for the public map: a
-- court or a trail carries other people's reviews and photos, and letting the
-- person who happened to add it erase all of that would make the map something
-- one contributor can quietly take back.
--
-- A private activity is not that. It is one person's own event — a party, a
-- wedding, a film shoot — visible only to the people they invited, and never
-- part of the shared map. If it is cancelled, the person who created it should
-- be able to remove it rather than write to support.
--
-- Scope, deliberately narrow:
--   created_by = auth.uid()      their own, not merely one they can see
--   visibility = 'private'       never anything on the public map
--   not is_banned()              matching every other write path
--
-- Public content stays undeletable by its creator. Note the interaction with
-- the 24-hour edit window from 0079: inside that window a creator can still
-- change `visibility`, so a public activity could be flipped private and
-- deleted within a day of being created. That is accepted — it is their own
-- content, hours old, with nothing built on top of it yet. After 24 hours
-- `visibility` is pinned by the guard trigger, so the route closes for good.
--
-- Worth knowing what this destroys: every foreign key into locations is ON
-- DELETE CASCADE, so the row takes its reviews, photos, saves, shares, list
-- items, reports and claims with it. For a private event those all belong to
-- the invitees of that event, which is the intent, but it is not recoverable.

create policy "creator deletes own private activity" on public.locations
  for delete
  using (
    created_by = auth.uid()
    and visibility = 'private'
    and not is_banned()
  );
