-- ---------------------------------------------------------------------------
-- list_likes (like counts for lists, surfaced on the redesigned "My lists" cards)
-- ---------------------------------------------------------------------------

create table list_likes (
  list_id uuid not null references lists (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

alter table list_likes enable row level security;

create policy "list owner or liker can view likes" on list_likes
  for select using (
    auth.uid() = user_id
    or exists (select 1 from lists where lists.id = list_id and lists.user_id = auth.uid())
  );

create policy "users like as themselves" on list_likes
  for insert with check (auth.uid() = user_id);

create policy "users remove their own like" on list_likes
  for delete using (auth.uid() = user_id);
