-- Friends list: sending a friend request requires the recipient's approval
-- before the connection is considered a friendship.

create table friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles (id) on delete cascade,
  recipient_id uuid not null references profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (requester_id, recipient_id),
  check (requester_id <> recipient_id)
);

create index friendships_recipient_idx on friendships (recipient_id);
create index friendships_requester_idx on friendships (requester_id);

alter table friendships enable row level security;

create policy "requester or recipient can view friendship" on friendships
  for select using (auth.uid() = requester_id or auth.uid() = recipient_id);

create policy "users send friend requests as themselves" on friendships
  for insert with check (auth.uid() = requester_id);

create policy "recipient can respond to a friend request" on friendships
  for update using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);

create policy "requester or recipient can remove friendship" on friendships
  for delete using (auth.uid() = requester_id or auth.uid() = recipient_id);
