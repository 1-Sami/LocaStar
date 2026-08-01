-- Blocking. Until now the only answer to an unwanted friend request was
-- "decline", which *deletes* the row (the status CHECK allows only 'pending'
-- and 'accepted'), so the sender was free to send again immediately, forever.
--
-- Scope: a block stops **all direct contact**, not just friend requests.
-- Friend requests are actually the least of it — they carry no message field.
-- `location_shares.note` is free text, and share recipients are found through
-- search_share_candidates(), which searches every user rather than just
-- friends. So the location share is a direct messaging channel to anyone in
-- the app, and blocking friend requests alone would close the quiet door and
-- leave the loud one open.
--
-- Direction: one-way, deliberately. A block stops the blocked person reaching
-- the blocker; the blocker can still reach out, and doing so lifts the block
-- (see below). Symmetric blocking would make that auto-lift impossible.
--
-- The blocked person is never told. A "you have been blocked" message mostly
-- provokes the escalation the block was for. Their send just fails like any
-- other error.

create table if not exists user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocker_idx on user_blocks (blocker_id);
-- The enforcement lookup is "has <recipient> blocked me", i.e. by the pair.
create index if not exists user_blocks_pair_idx on user_blocks (blocked_id, blocker_id);

alter table user_blocks enable row level security;

grant select, insert, delete on user_blocks to authenticated;

-- Only ever your own blocks: the blocked person must not be able to read the
-- row, or the list becomes a way to discover who blocked you.
create policy "users read own blocks" on user_blocks
  for select using (blocker_id = auth.uid());

-- Deliberately not ban-guarded. Blocking is self-protection, not publishing,
-- and a restricted account still deserves to keep people away from it.
create policy "users block others" on user_blocks
  for insert with check (blocker_id = auth.uid());

create policy "users remove own blocks" on user_blocks
  for delete using (blocker_id = auth.uid());

-- Has `recipient` blocked the current user?
--
-- Security definer because the blocked person cannot select the row — that is
-- the point. The parameter is the *other* party and the subject is always
-- auth.uid(), so the only question anyone can ask is "am I blocked by X",
-- which they could already answer by trying to send something.
create or replace function public.is_blocked_from(recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_blocks
    where blocker_id = recipient
      and blocked_id = auth.uid()
  );
$$;

grant execute on function public.is_blocked_from(uuid) to anon, authenticated;

-- Enforcement on all three inbound channels. `alter policy` rather than
-- drop/create so the tables are never momentarily unguarded.
alter policy "users send friend requests as themselves" on friendships
  with check (
    auth.uid() = requester_id
    and not is_banned()
    and not is_blocked_from(recipient_id)
  );

alter policy "users send shares as themselves" on location_shares
  with check (
    auth.uid() = sender_id
    and not is_banned()
    and not is_blocked_from(recipient_id)
    and exists (
      select 1 from locations l
      where l.id = location_shares.location_id
        and (l.visibility = 'public' or l.created_by = auth.uid())
    )
  );

alter policy "list owner can share their list" on list_shares
  with check (
    auth.uid() = sender_id
    and not is_banned()
    and not is_blocked_from(recipient_id)
    and exists (
      select 1 from lists
      where lists.id = list_shares.list_id
        and lists.user_id = auth.uid()
    )
  );

-- Blocking someone you are already friends with should end the friendship,
-- otherwise they keep everything the friendship granted. Covers a pending
-- request in either direction too, since both live in this table.
create or replace function public.clear_friendship_on_block()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from friendships
  where (requester_id = new.blocker_id and recipient_id = new.blocked_id)
     or (requester_id = new.blocked_id and recipient_id = new.blocker_id);
  return new;
end;
$$;

drop trigger if exists clear_friendship_on_block on user_blocks;
create trigger clear_friendship_on_block
after insert on user_blocks
for each row execute function public.clear_friendship_on_block();

-- Reaching out undoes your own block. If you blocked someone and later send
-- them a friend request, you have plainly changed your mind, and making you
-- find the block list first would be silly.
--
-- Note the direction: this only fires for a request sent *by the blocker*. A
-- request from the blocked person can't reach this trigger at all — the policy
-- above refuses it first. That ordering is the whole feature; if it were the
-- other way round, one re-send would clear any block.
create or replace function public.lift_block_on_outbound_request()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from user_blocks
  where blocker_id = new.requester_id
    and blocked_id = new.recipient_id;
  return new;
end;
$$;

drop trigger if exists lift_block_on_outbound_request on friendships;
create trigger lift_block_on_outbound_request
after insert on friendships
for each row execute function public.lift_block_on_outbound_request();
