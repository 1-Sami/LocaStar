-- A shared list showed no attribution at all: opening someone's community list
-- gave you its name and its places, but not who made it or how current it is.
-- The Community *card* already says "by <username>"; the detail screen it opens
-- said nothing.
--
-- Creator and created_at already exist (lists.user_id, lists.created_at). Last
-- modified did not, so add it.
--
-- "Modified" means what a reader would expect it to mean: the list's own
-- details changed (name, description, visibility, cover), or its contents
-- changed. It deliberately does *not* include emptied_at, which is bookkeeping
-- this schema maintains for the cleanup job rather than anything the owner did.

alter table lists add column if not exists updated_at timestamptz;

-- Backfill to created_at rather than now(). Defaulting to now() would claim
-- every existing list was edited the day this migration ran, which is a lie
-- that then shows up in the UI.
update lists set updated_at = created_at where updated_at is null;

alter table lists alter column updated_at set default now();
alter table lists alter column updated_at set not null;

comment on column lists.updated_at is
  'Last time the list''s own details or its contents changed. Not touched by emptied_at bookkeeping.';

create or replace function public.touch_list_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Only the fields a person actually edits. Without this test, the cleanup
  -- job's emptied_at write would register as a modification.
  if new.name is distinct from old.name
     or new.description is distinct from old.description
     or new.is_public is distinct from old.is_public
     or new.cover_image is distinct from old.cover_image then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists lists_touch_updated_at on lists;
create trigger lists_touch_updated_at
before update on lists
for each row execute function public.touch_list_updated_at();

-- Adding or removing a place is a modification too, so fold that into the
-- trigger that already watches list_items for the emptiness clock.
create or replace function public.track_list_emptied()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  target uuid := coalesce(new.list_id, old.list_id);
  remaining int;
begin
  select count(*) into remaining from list_items where list_id = target;

  if remaining = 0 then
    -- coalesce keeps the original emptied_at, so re-running never pushes the
    -- cleanup deadline back.
    update lists
    set emptied_at = coalesce(emptied_at, now()), updated_at = now()
    where id = target;
  else
    update lists
    set emptied_at = null, updated_at = now()
    where id = target;
  end if;

  return null;
end;
$$;
