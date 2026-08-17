-- What the trash gives back to the void, and when.
--
-- Kept apart from 0105 on purpose. That migration only records when something
-- was removed and is safe on its own; this one is the part that destroys data
-- on a timer, and it should be readable as its own decision.
--
-- Rows only get here by being *both* status = 'removed' and stamped more than
-- thirty days ago. Two conditions rather than one because a single stray column
-- must never be enough to delete somebody's content — see the note in 0105
-- about pinning removed_at in the creator guard.
--
-- Photos are the reason this cannot be a plain cron DELETE like
-- delete-empty-public-lists. The media bucket is public, so deleting the row
-- while leaving the object behind would leave the picture fetchable by anyone
-- who still has its URL — for content removed *because* it was inappropriate,
-- that is the one outcome worth avoiding. Storage can only be emptied through
-- the storage API, so an edge function does the work and this function only
-- says what is due, including everything that would disappear by cascade.

create or replace function public.expired_removed_content()
returns table (kind text, row_id uuid, storage_paths text[])
language sql
security definer
set search_path to 'public'
as $function$
  with cutoff as (select now() - interval '30 days' as before)
  -- Locations take their photos, their reviews and those reviews' photos with
  -- them, so every path underneath has to be collected before the row goes.
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
    -- Skip anything whose location is going anyway; the cascade handles it and
    -- listing it twice would have the edge function delete a row that no longer
    -- exists.
    and not exists (
      select 1 from locations l where l.id = r.location_id
        and l.status = 'removed' and l.removed_at < cutoff.before
    )

  union all

  select 'location_photo', lp.id, array[lp.storage_path]
  from location_photos lp, cutoff
  where lp.removed_at is not null and lp.removed_at < cutoff.before
    and not exists (
      select 1 from locations l where l.id = lp.location_id
        and l.status = 'removed' and l.removed_at < cutoff.before
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
        and l.status = 'removed' and l.removed_at < cutoff.before
    );
$function$;

-- Read by the scheduled job alone. Nobody signed in has any business
-- enumerating removed content.
revoke all on function public.expired_removed_content() from public, anon, authenticated;
grant execute on function public.expired_removed_content() to service_role;
