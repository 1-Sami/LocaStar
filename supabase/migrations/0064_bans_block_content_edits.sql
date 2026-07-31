-- Bans blocked INSERTs but not UPDATEs, so a ban did not stop someone from
-- rewriting content they had already posted.
--
-- Proven against the live database with a rolled-back probe: with an active
-- ban and is_banned() returning true, `insert into reviews` was correctly
-- refused, while `update reviews set body = ...` on the user's own existing
-- review succeeded and the new text stuck.
--
-- That is the whole ban, defeated, by exactly the population bans are for:
-- someone gets banned *because* of what they posted, so by definition they
-- already have rows to edit. Terms of Service promise that while restricted
-- "you cannot post reviews, add places, share, or send requests" — editing a
-- review into new abusive text is posting, whatever the SQL verb is.
--
-- Every INSERT policy that creates user content already carries `not
-- is_banned()`; this brings the matching UPDATE policies in line. lists and
-- list_items were already guarded on UPDATE, so they need no change.
--
-- Moderator paths are deliberately left un-guarded: a moderator acting on
-- content is not the banned party, and gating moderation on the moderator's own
-- ban status would let a ban disable the people who undo bans.

-- Reviews: author may edit only while not banned. Moderators always may.
-- `alter policy` rather than drop/create, so there is never an instant where
-- the table sits with the policy missing.
alter policy "users edit own reviews" on reviews
  using (((user_id = auth.uid()) and not is_banned()) or is_moderator())
  with check (((user_id = auth.uid()) and not is_banned()) or is_moderator());

-- Locations, verified-owner path. The creator path is already inert here —
-- restrict_creator_location_update() is a BEFORE trigger that silently reverts
-- a creator's edits to the pinned columns, so a banned creator's rename was
-- already a no-op. A *verified* owner is not restricted by that trigger, so
-- this is the path that actually needed the guard.
alter policy "moderator or verified owner edit location" on locations
  using (
    is_moderator()
    or (claimed_by = auth.uid() and is_verified = true and not is_banned())
  )
  with check (
    is_moderator()
    or (claimed_by = auth.uid() and is_verified = true and not is_banned())
  );

-- Creator credit removal: hiding your own name is a privacy action, not
-- publishing, so a banned user keeps it. Guarding it would trap a banned
-- creator's name on content they can no longer edit. Left intentionally alone.
