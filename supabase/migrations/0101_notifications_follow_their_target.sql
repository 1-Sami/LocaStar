-- Delete notifications whose subject has been deleted.
--
-- A notification names its subject inside a jsonb payload — location_id,
-- list_id — rather than through a foreign key, so nothing cascades and a row
-- outlives the thing it is about. Tapping it opens "this location couldn't be
-- found".
--
-- Not an edge case. Two scheduled jobs delete rows on their own:
--
--   delete-expired-activities  hourly   removes every activity once it ends
--   delete-empty-public-lists  nightly  removes lists left empty
--
-- So the reminders feature produces a dead link for every activity it ever
-- reminds anyone about, an hour after the event finishes. Found by checking
-- the live table after the owner deleted a test activity: their reminder was
-- still there, pointing at nothing.
--
-- Deleting the notification is the honest answer rather than teaching the
-- screen to render a tombstone. The activity is over and the place is gone;
-- there is nothing left to say about it and nowhere to go.
--
-- A payload without the key, or with something that is not a uuid, must not
-- break a delete — hence the `?` guard and the regex before the cast. jsonb ->>
-- returns text, and casting 'not-a-uuid'::uuid raises rather than returning
-- null.

create or replace function public.delete_notifications_for_location()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  delete from notifications n
  where n.payload ? 'location_id'
    and n.payload ->> 'location_id' ~ '^[0-9a-fA-F-]{36}$'
    and (n.payload ->> 'location_id')::uuid = old.id;
  return old;
end;
$function$;

create or replace function public.delete_notifications_for_list()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  delete from notifications n
  where n.payload ? 'list_id'
    and n.payload ->> 'list_id' ~ '^[0-9a-fA-F-]{36}$'
    and (n.payload ->> 'list_id')::uuid = old.id;
  return old;
end;
$function$;

drop trigger if exists locations_delete_notifications on public.locations;
create trigger locations_delete_notifications
  after delete on public.locations
  for each row execute function public.delete_notifications_for_location();

drop trigger if exists lists_delete_notifications on public.lists;
create trigger lists_delete_notifications
  after delete on public.lists
  for each row execute function public.delete_notifications_for_list();

-- Clear the ones already orphaned, including the owner's test reminder.
delete from public.notifications n
where n.payload ? 'location_id'
  and n.payload ->> 'location_id' ~ '^[0-9a-fA-F-]{36}$'
  and not exists (select 1 from public.locations l where l.id = (n.payload ->> 'location_id')::uuid);

delete from public.notifications n
where n.payload ? 'list_id'
  and n.payload ->> 'list_id' ~ '^[0-9a-fA-F-]{36}$'
  and not exists (select 1 from public.lists l where l.id = (n.payload ->> 'list_id')::uuid);
