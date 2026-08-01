-- Empty public lists accumulate in the Community tab and only their creator
-- could remove them. Two changes: they now expire on their own, and moderators
-- can delete a list the way they can act on other content.
--
-- "Empty for 14 days" needs a real timestamp. `lists` only had `created_at`,
-- and using that would delete a list emptied *yesterday* just because it was
-- created a month ago — punishing the person who curated a list for weeks and
-- then cleared it to start again. So track when a list actually became empty.

alter table lists add column if not exists emptied_at timestamptz;

comment on column lists.emptied_at is
  'When the list last became empty; null while it has items. Drives the nightly cleanup of empty public lists.';

-- Existing empty lists have been empty since they were created — that is the
-- only honest value available for them, and it is the true one for a list that
-- never had items, which is the case this feature is aimed at.
update lists l
set emptied_at = l.created_at
where l.emptied_at is null
  and not exists (select 1 from list_items li where li.list_id = l.id);

create index if not exists lists_emptied_at_idx on lists (emptied_at)
  where emptied_at is not null;

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
    -- coalesce, so re-running doesn't push the deadline back. The clock does
    -- legitimately restart when items are added and later removed, because the
    -- insert branch below clears it — the list genuinely wasn't empty then.
    update lists set emptied_at = coalesce(emptied_at, now())
    where id = target and emptied_at is null;
  else
    update lists set emptied_at = null
    where id = target and emptied_at is not null;
  end if;

  return null;
end;
$$;

drop trigger if exists list_items_track_emptied on list_items;
create trigger list_items_track_emptied
after insert or delete on list_items
for each row execute function public.track_list_emptied();

-- Nightly sweep. Public only, deliberately: an empty *private* list clutters
-- nothing and is the owner's own business, so deleting it would be destroying
-- someone's data to solve a problem that doesn't exist. The `not exists` guard
-- is belt-and-braces in case emptied_at were ever stale.
--
-- Runs as the cron owner, which bypasses RLS, so it is not affected by the
-- delete policies below. auth.uid() is null in that context, which is what
-- keeps the audit trigger from logging these as moderator actions.
select cron.unschedule('delete-empty-public-lists')
where exists (select 1 from cron.job where jobname = 'delete-empty-public-lists');

select cron.schedule(
  'delete-empty-public-lists',
  '30 3 * * *',
  $$
    delete from lists
    where is_public
      and emptied_at is not null
      and emptied_at < now() - interval '14 days'
      and not exists (select 1 from list_items li where li.list_id = lists.id);
  $$
);

-- Moderators can delete a list. Added as a separate permissive policy so the
-- owner's own "users delete own lists" is untouched; permissive policies OR
-- together.
--
-- This is is_moderator() (superuser + admin) rather than admin-only as it is
-- for locations. A location carries other people's reviews, saves and photos,
-- so hard-deleting one is a bigger act and stays with admins; a list is a
-- name, a description and a set of pointers. `lists` also has no status
-- column, so there is no flag-or-hide middle step to reach for — delete is the
-- only tool available.
drop policy if exists "moderators delete lists" on lists;
create policy "moderators delete lists" on lists
  for delete using (is_moderator());

-- Every moderator deletion lands in the audit log, like every other moderation
-- action. Owners tidying their own lists are not moderation, and neither is the
-- nightly sweep, which has no auth.uid() at all.
create or replace function public.log_list_deleted()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is not null
     and auth.uid() is distinct from old.user_id
     and is_moderator() then
    perform log_moderation_action(
      'list_deleted', 'list', old.id,
      jsonb_build_object(
        'name', old.name,
        'owner', old.user_id,
        'was_public', old.is_public
      )
    );
  end if;
  return old;
end;
$$;

drop trigger if exists lists_log_delete on lists;
create trigger lists_log_delete
after delete on lists
for each row execute function public.log_list_deleted();
