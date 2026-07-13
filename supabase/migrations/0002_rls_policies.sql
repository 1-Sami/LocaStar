-- Row Level Security: public read on active/visible content, owner-write on
-- own content, admin bypass. Pending/flagged content is hidden from public reads.

create function is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;

create policy "profiles are publicly readable" on profiles
  for select using (true);

create policy "users update own profile" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

alter table categories enable row level security;

create policy "categories are publicly readable" on categories
  for select using (true);

-- ---------------------------------------------------------------------------
-- locations
-- ---------------------------------------------------------------------------

alter table locations enable row level security;

create policy "active locations are publicly readable" on locations
  for select using (
    status = 'active' or created_by = auth.uid() or is_admin()
  );

create policy "authenticated users submit locations" on locations
  for insert with check (
    auth.uid() = created_by and status = 'pending'
  );

create policy "owners edit own pending locations" on locations
  for update using (
    (created_by = auth.uid() and status = 'pending') or is_admin()
  ) with check (
    (created_by = auth.uid() and status = 'pending') or is_admin()
  );

-- ---------------------------------------------------------------------------
-- location_categories
-- ---------------------------------------------------------------------------

alter table location_categories enable row level security;

create policy "location categories are publicly readable" on location_categories
  for select using (true);

create policy "location owners tag their own locations" on location_categories
  for insert with check (
    is_admin() or exists (
      select 1 from locations
      where locations.id = location_id and locations.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- location_photos
-- ---------------------------------------------------------------------------

alter table location_photos enable row level security;

create policy "location photos are publicly readable" on location_photos
  for select using (true);

create policy "authenticated users add location photos" on location_photos
  for insert with check (auth.uid() = user_id);

create policy "users manage own location photos" on location_photos
  for delete using (auth.uid() = user_id or is_admin());

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------

alter table reviews enable row level security;

create policy "visible reviews are publicly readable" on reviews
  for select using (status = 'visible' or user_id = auth.uid() or is_admin());

create policy "authenticated users write reviews" on reviews
  for insert with check (auth.uid() = user_id);

create policy "users edit own reviews" on reviews
  for update using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

create policy "users delete own reviews" on reviews
  for delete using (user_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- review_photos
-- ---------------------------------------------------------------------------

alter table review_photos enable row level security;

create policy "review photos are publicly readable" on review_photos
  for select using (true);

create policy "review authors add review photos" on review_photos
  for insert with check (
    exists (select 1 from reviews where reviews.id = review_id and reviews.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- review_likes
-- ---------------------------------------------------------------------------

alter table review_likes enable row level security;

create policy "review likes are publicly readable" on review_likes
  for select using (true);

create policy "users like reviews as themselves" on review_likes
  for insert with check (auth.uid() = user_id);

create policy "users remove their own likes" on review_likes
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- review_reports
-- ---------------------------------------------------------------------------

alter table review_reports enable row level security;

create policy "reporters and admins view reports" on review_reports
  for select using (reporter_id = auth.uid() or is_admin());

create policy "authenticated users file reports" on review_reports
  for insert with check (auth.uid() = reporter_id);

create policy "admins resolve reports" on review_reports
  for update using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- saves (favorites / bucket list) — fully private
-- ---------------------------------------------------------------------------

alter table saves enable row level security;

create policy "users manage own saves" on saves
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- lists / list_items — private-only for MVP
-- ---------------------------------------------------------------------------

alter table lists enable row level security;

create policy "users manage own lists" on lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table list_items enable row level security;

create policy "users manage own list items" on list_items
  for all using (
    exists (select 1 from lists where lists.id = list_id and lists.user_id = auth.uid())
  ) with check (
    exists (select 1 from lists where lists.id = list_id and lists.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- location_shares
-- ---------------------------------------------------------------------------

alter table location_shares enable row level security;

create policy "sender and recipient view shares" on location_shares
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "users send shares as themselves" on location_shares
  for insert with check (auth.uid() = sender_id);

create policy "sender or recipient remove a share" on location_shares
  for delete using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- ---------------------------------------------------------------------------
-- notifications — inserted by triggers/Edge Functions (service role), not clients
-- ---------------------------------------------------------------------------

alter table notifications enable row level security;

create policy "users view own notifications" on notifications
  for select using (auth.uid() = user_id);

create policy "users mark own notifications read" on notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- business_claims
-- ---------------------------------------------------------------------------

alter table business_claims enable row level security;

create policy "claimants and admins view claims" on business_claims
  for select using (auth.uid() = user_id or is_admin());

create policy "authenticated users file a claim" on business_claims
  for insert with check (auth.uid() = user_id);

create policy "admins decide claims" on business_claims
  for update using (is_admin()) with check (is_admin());
