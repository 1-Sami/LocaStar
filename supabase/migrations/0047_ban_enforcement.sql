-- Enforce bans as "read-only": a banned user can still sign in (so they can see
-- why they were banned and how to appeal) but cannot create anything other
-- people can see or receive.
--
-- Deliberately NOT gated: `saves` (favourites / bucket list). Those are private
-- to the user, invisible to anyone else, and carry no abuse potential — blocking
-- them would only be spiteful.
--
-- Existing content is left visible; hiding it is a separate moderation decision
-- made per item, not an automatic side effect of a ban.

-- Content
drop policy "authenticated users write reviews" on reviews;
create policy "authenticated users write reviews" on reviews
  for insert to authenticated
  with check (auth.uid() = user_id and not is_banned());

drop policy "authenticated users submit locations" on locations;
create policy "authenticated users submit locations" on locations
  for insert to authenticated
  with check (auth.uid() = created_by and status = 'active'::location_status and not is_banned());

drop policy "location owners tag their own locations" on location_categories;
create policy "location owners tag their own locations" on location_categories
  for insert to authenticated
  with check (
    is_admin()
    or (
      not is_banned()
      and exists (
        select 1 from locations
        where locations.id = location_categories.location_id
          and locations.created_by = auth.uid()
      )
    )
  );

-- Photos
drop policy "authenticated users add location photos" on location_photos;
create policy "authenticated users add location photos" on location_photos
  for insert to authenticated
  with check (auth.uid() = user_id and not is_banned());

drop policy "review authors add review photos" on review_photos;
create policy "review authors add review photos" on review_photos
  for insert to authenticated
  with check (
    not is_banned()
    and exists (
      select 1 from reviews
      where reviews.id = review_photos.review_id and reviews.user_id = auth.uid()
    )
  );

-- Reactions
drop policy "users like reviews as themselves" on review_likes;
create policy "users like reviews as themselves" on review_likes
  for insert to authenticated
  with check (auth.uid() = user_id and not is_banned());

drop policy "users like as themselves" on list_likes;
create policy "users like as themselves" on list_likes
  for insert to authenticated
  with check (auth.uid() = user_id and not is_banned());

-- Anything delivered to another person — the harassment surface
drop policy "users send shares as themselves" on location_shares;
create policy "users send shares as themselves" on location_shares
  for insert to authenticated
  with check (
    auth.uid() = sender_id
    and not is_banned()
    and exists (
      select 1 from locations l
      where l.id = location_shares.location_id
        and (l.visibility = 'public' or l.created_by = auth.uid())
    )
  );

drop policy "list owner can share their list" on list_shares;
create policy "list owner can share their list" on list_shares
  for insert to authenticated
  with check (
    auth.uid() = sender_id
    and not is_banned()
    and exists (
      select 1 from lists
      where lists.id = list_shares.list_id and lists.user_id = auth.uid()
    )
  );

drop policy "users send friend requests as themselves" on friendships;
create policy "users send friend requests as themselves" on friendships
  for insert to authenticated
  with check (auth.uid() = requester_id and not is_banned());

-- Reports and claims
drop policy "authenticated users file location reports" on location_reports;
create policy "authenticated users file location reports" on location_reports
  for insert to authenticated
  with check (auth.uid() = reporter_id and not is_banned());

drop policy "authenticated users file reports" on review_reports;
create policy "authenticated users file reports" on review_reports
  for insert to authenticated
  with check (auth.uid() = reporter_id and not is_banned());

drop policy "authenticated users file a claim" on business_claims;
create policy "authenticated users file a claim" on business_claims
  for insert to authenticated
  with check (auth.uid() = user_id and not is_banned());

-- Lists: split the old ALL policy so reading your own lists still works while
-- banned, but creating and editing them does not.
drop policy "users manage own lists" on lists;
create policy "users read own lists" on lists
  for select using (auth.uid() = user_id);
create policy "users write own lists" on lists
  for insert to authenticated with check (auth.uid() = user_id and not is_banned());
create policy "users update own lists" on lists
  for update using (auth.uid() = user_id and not is_banned())
  with check (auth.uid() = user_id and not is_banned());
create policy "users delete own lists" on lists
  for delete using (auth.uid() = user_id);

drop policy "users manage own list items" on list_items;
create policy "users read own list items" on list_items
  for select using (
    exists (select 1 from lists where lists.id = list_items.list_id and lists.user_id = auth.uid())
  );
create policy "users write own list items" on list_items
  for insert to authenticated
  with check (
    not is_banned()
    and exists (select 1 from lists where lists.id = list_items.list_id and lists.user_id = auth.uid())
  );
create policy "users update own list items" on list_items
  for update using (
    not is_banned()
    and exists (select 1 from lists where lists.id = list_items.list_id and lists.user_id = auth.uid())
  );
create policy "users delete own list items" on list_items
  for delete using (
    exists (select 1 from lists where lists.id = list_items.list_id and lists.user_id = auth.uid())
  );
