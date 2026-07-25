-- Let anyone (including logged-out browsing) read a public list, its item
-- previews, and its like count — needed for the new "Community" tab that
-- browses public lists across all users. These are additive permissive
-- policies (Postgres OR-combines multiple policies per command), so they
-- only add an "or is_public" read path and cannot weaken the existing
-- owner-only / share-recipient-only access.
create policy "anyone can view public lists" on lists
  for select using (is_public = true);

create policy "anyone can view public list items" on list_items
  for select using (
    exists (select 1 from lists where lists.id = list_items.list_id and lists.is_public = true)
  );

-- Without this, fetchLikeInfo would silently undercount likes on every
-- public list except ones the viewer personally liked, since RLS would
-- filter out other users' like rows.
create policy "anyone can view public list likes" on list_likes
  for select using (
    exists (select 1 from lists where lists.id = list_likes.list_id and lists.is_public = true)
  );
