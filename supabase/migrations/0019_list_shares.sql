-- Sharing an entire list with another user (mirrors location_shares).

create table list_shares (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references lists (id) on delete cascade,
  sender_id uuid not null references profiles (id) on delete cascade,
  recipient_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index list_shares_recipient_idx on list_shares (recipient_id);

alter table list_shares enable row level security;

create policy "sender or recipient can view list shares" on list_shares
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "list owner can share their list" on list_shares
  for insert with check (
    auth.uid() = sender_id
    and exists (select 1 from lists where id = list_id and user_id = auth.uid())
  );

create policy "sender or recipient can delete list share" on list_shares
  for delete using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- Let a recipient read a list (and its items) that was shared with them,
-- even though it's not public and not theirs.

create policy "recipient can view shared list" on lists
  for select using (
    exists (
      select 1 from list_shares
      where list_shares.list_id = lists.id and list_shares.recipient_id = auth.uid()
    )
  );

create policy "recipient can view shared list items" on list_items
  for select using (
    exists (
      select 1 from list_shares
      join lists on lists.id = list_shares.list_id
      where list_shares.list_id = list_items.list_id and list_shares.recipient_id = auth.uid()
    )
  );

-- Notify the recipient when a list is shared with them.

create function notify_on_list_share()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  recipient_prefs jsonb;
  sender_name text;
  list_name text;
begin
  select notification_preferences into recipient_prefs from profiles where id = new.recipient_id;

  if (recipient_prefs ->> 'shares')::boolean is not false then
    select coalesce(username, display_name, 'Someone') into sender_name from profiles where id = new.sender_id;
    select name into list_name from lists where id = new.list_id;

    insert into notifications (user_id, type, payload)
    values (
      new.recipient_id,
      'list_share',
      jsonb_build_object(
        'list_id', new.list_id,
        'list_name', list_name,
        'sender_name', sender_name
      )
    );
  end if;

  return new;
end;
$$;

create trigger on_list_share_created
  after insert on list_shares
  for each row execute function notify_on_list_share();
