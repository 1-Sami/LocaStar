-- Saving a community list to your own Saved page. Distinct from list_likes:
-- a like is public appreciation shown on the card, a save is private and only
-- affects where the list shows up for you.
create table if not exists list_saves (
  user_id uuid not null references profiles(id) on delete cascade,
  list_id uuid not null references lists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, list_id)
);

create index if not exists list_saves_user_idx on list_saves (user_id, created_at desc);

alter table list_saves enable row level security;

-- Saves are private: only the person who made them can see or manage them.
create policy "users read own list saves" on list_saves
  for select using (user_id = auth.uid());

create policy "users save lists" on list_saves
  for insert to authenticated
  with check (user_id = auth.uid() and not is_banned());

create policy "users unsave lists" on list_saves
  for delete using (user_id = auth.uid());

-- Tell someone when they're made a Superuser. Fires from the same role change
-- the audit log already records, so the two can never disagree.
create or replace function notify_on_role_grant()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and new.role = 'superuser' then
    insert into notifications (user_id, type, payload)
    values (
      new.id,
      'role_granted',
      jsonb_build_object('role', 'superuser')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_notify_role_grant on profiles;
create trigger profiles_notify_role_grant
  after update on profiles
  for each row execute function notify_on_role_grant();
