-- An activity that ends stops being deleted, and becomes its creator's to keep.
--
-- The hourly job used to delete the row outright, which took its reviews and
-- photos by cascade — and with them the author's contribution and their profile
-- counts, silently. Losing the reviews is correct and stays: a festival's
-- reviews exist to help somebody decide whether to go this week, and a
-- recurring festival is re-added as a new activity each year, so last year's
-- would attach to nothing. Losing the *record that you ran it* is not.
--
-- So the row survives as 'past' and the content on it does not.
--
-- No RLS change is needed to hide it. The existing SELECT policy already reads
--   created_by = auth.uid() OR is_moderator() OR (status = 'active' AND ...)
-- so 'past' falls out of the third branch for everybody else and stays visible
-- to the person who added it. nearby_locations filters status = 'active' too,
-- so search and the map lose it without being touched.

/*
 * Ending an activity, once an hour.
 *
 * Saves and notifications go with it. Someone who bookmarked a festival should
 * not keep a bookmark to something they can no longer open, and a "last day"
 * reminder must not sit in their list pointing at a row that is now invisible
 * to them — which is the same dangling-notification problem 0101 fixed for
 * deletion, arriving by a different route.
 */
create or replace function public.retire_expired_activities()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  retired uuid[];
begin
  with done as (
    update locations
       set status = 'past'
     where kind = 'activity'
       and status = 'active'
       and expires_at is not null
       and expires_at < now()
       -- Boosted activities were exempt from the old delete; keep them exempt
       -- from ending too, so paid placement behaves the same as it did.
       and not coalesce(is_boosted, false)
    returning id
  )
  select coalesce(array_agg(id), '{}') into retired from done;

  if array_length(retired, 1) is null then
    return 0;
  end if;

  delete from saves where location_id = any(retired);

  delete from notifications n
   where n.payload ? 'location_id'
     and n.payload ->> 'location_id' ~ '^[0-9a-fA-F-]{36}$'
     and (n.payload ->> 'location_id')::uuid = any(retired);

  return array_length(retired, 1);
end;
$function$;

revoke all on function public.retire_expired_activities() from public, anon, authenticated;

-- Replaces the delete that ran here before.
select cron.unschedule('delete-expired-activities');
select cron.schedule(
  'retire-expired-activities',
  '0 * * * *',
  $$ select public.retire_expired_activities(); $$
);

/*
 * The creator may clear a past activity of their own.
 *
 * Until now they could only delete a *private* one; a public activity was
 * admin-only, which made sense while it was live and nobody else's business
 * once it is over and invisible to everyone but them.
 */
create policy "creator deletes own past activity"
  on public.locations for delete
  using (created_by = auth.uid() and status = 'past' and not is_banned());

/*
 * Reviews and photos on a past activity are due for deletion immediately.
 *
 * Not after thirty days: that window exists so a moderator can undo a
 * judgement call, and an activity reaching its end date is not a judgement
 * call. They ride the same nightly job because it is the only thing that
 * empties storage as well as rows, and a removed photo whose object survived
 * would still be fetchable by URL.
 */
create or replace function public.expired_removed_content()
returns table (kind text, row_id uuid, storage_paths text[])
language sql
security definer
set search_path to 'public'
as $function$
  with cutoff as (select now() - interval '30 days' as before)
  select 'location', l.id,
         coalesce(
           array(select lp.storage_path from location_photos lp where lp.location_id = l.id)
           || array(
                select rp.storage_path from review_photos rp
                join reviews r on r.id = rp.review_id
                where r.location_id = l.id
              ),
           '{}'::text[]
         )
  from locations l, cutoff
  where l.status = 'removed' and l.removed_at is not null and l.removed_at < cutoff.before

  union all

  select 'review', r.id,
         coalesce(array(select rp.storage_path from review_photos rp where rp.review_id = r.id), '{}'::text[])
  from reviews r, cutoff
  where r.status = 'removed' and r.removed_at is not null and r.removed_at < cutoff.before
    and not exists (
      select 1 from locations l where l.id = r.location_id
        and l.status = 'removed' and l.removed_at < cutoff.before
    )

  union all

  -- Everything written on an activity that has now ended.
  select 'review', r.id,
         coalesce(array(select rp.storage_path from review_photos rp where rp.review_id = r.id), '{}'::text[])
  from reviews r
  join locations l on l.id = r.location_id
  where l.kind = 'activity' and l.status = 'past'

  union all

  select 'location_photo', lp.id, array[lp.storage_path]
  from location_photos lp
  join locations l on l.id = lp.location_id
  where l.kind = 'activity' and l.status = 'past'

  union all

  select 'location_photo', lp.id, array[lp.storage_path]
  from location_photos lp, cutoff
  where lp.removed_at is not null and lp.removed_at < cutoff.before
    and not exists (
      select 1 from locations l where l.id = lp.location_id
        and l.status = 'removed' and l.removed_at < cutoff.before
    )
    -- Already listed by the past-activity branch above.
    and not exists (
      select 1 from locations l where l.id = lp.location_id
        and l.kind = 'activity' and l.status = 'past'
    )

  union all

  select 'review_photo', rp.id, array[rp.storage_path]
  from review_photos rp
  join reviews r on r.id = rp.review_id, cutoff
  where rp.removed_at is not null and rp.removed_at < cutoff.before
    and not exists (
      select 1 from reviews r2 where r2.id = rp.review_id
        and r2.status = 'removed' and r2.removed_at < cutoff.before
    )
    and not exists (
      select 1 from locations l where l.id = r.location_id
        and ((l.status = 'removed' and l.removed_at < cutoff.before)
             or (l.kind = 'activity' and l.status = 'past'))
    );
$function$;

revoke all on function public.expired_removed_content() from public, anon, authenticated;
grant execute on function public.expired_removed_content() to service_role;
