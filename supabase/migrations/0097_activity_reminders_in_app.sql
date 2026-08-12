-- Write the in-app notification alongside the push.
--
-- Reminders only ever existed as a push. The phone buzzed and the app's own
-- notifications page stayed empty, which is the opposite of every other kind we
-- send — shares, list shares, role grants and friend requests all land in the
-- list and survive being dismissed. A push is the most losable thing we produce:
-- swipe it away, or read it on a phone that is not the one you open later, and
-- there is no second copy.
--
-- The insert goes in this function rather than the edge function because this is
-- where the claim happens. One statement decides who is reminded, records that
-- they were, and now records what they were told — so the in-app row cannot
-- disagree with activity_reminder_sends about whether a reminder happened.
--
-- Cardinality matters here: `noted` selects from `claimed`, which is one row per
-- (location, user). The final select joins device_tokens and fans out to one row
-- per *device*. Writing the notification from that instead would give somebody
-- with a phone and a tablet two identical entries.
--
-- The device_tokens requirement is dropped from `due`, and that is the point of
-- the change rather than an accident. Migration 0096 added it so reminders were
-- not marked sent for people who had no way to receive one — correct while push
-- was the only channel. It no longer is. Someone who declined the permission, or
-- whose token has not been registered yet, now gets the reminder in the app,
-- which is exactly what that filter was preventing.
--
-- An unreferenced data-modifying CTE still runs: Postgres executes them exactly
-- once and to completion whether or not the primary query reads their output.

create or replace function public.claim_activity_reminders()
returns table(
  push_token text,
  platform text,
  location_id uuid,
  activity_name text,
  starts_at timestamp with time zone
)
language sql
security definer
set search_path to 'public'
as $function$
  with bounds as (
    select
      (date_trunc('day', now() at time zone 'Europe/Stockholm') + interval '1 day')
        at time zone 'Europe/Stockholm' as tomorrow_start,
      (date_trunc('day', now() at time zone 'Europe/Stockholm') + interval '2 days')
        at time zone 'Europe/Stockholm' as tomorrow_end
  ),
  due as (
    select distinct s.user_id, l.id as location_id, l.name, l.starts_at
    from locations l
    join saves s on s.location_id = l.id
    join profiles p on p.id = s.user_id
    cross join bounds b
    where l.kind = 'activity'
      and l.status = 'active'
      and l.starts_at >= b.tomorrow_start
      and l.starts_at < b.tomorrow_end
      and coalesce((p.notification_preferences ->> 'reminders')::boolean, true)
      and not exists (
        select 1 from user_bans ub
        where ub.user_id = s.user_id
          and ub.status in ('pending', 'active')
          and (ub.expires_at is null or ub.expires_at > now())
      )
      and (
        l.visibility = 'public'
        or l.created_by = s.user_id
        or exists (
          select 1 from location_shares ls
          where ls.location_id = l.id and ls.recipient_id = s.user_id
        )
      )
  ),
  claimed as (
    insert into activity_reminder_sends (location_id, user_id)
    select d.location_id, d.user_id from due d
    on conflict (location_id, user_id) do nothing
    returning location_id, user_id
  ),
  noted as (
    insert into notifications (user_id, type, payload)
    select
      c.user_id,
      'activity_reminder',
      jsonb_build_object(
        'location_id', c.location_id,
        'location_name', d.name,
        'starts_at', d.starts_at
      )
    from claimed c
    join due d on d.location_id = c.location_id and d.user_id = c.user_id
    returning 1
  )
  select dt.token, dt.platform, c.location_id, d.name, d.starts_at
  from claimed c
  join due d on d.location_id = c.location_id and d.user_id = c.user_id
  join device_tokens dt on dt.user_id = c.user_id;
$function$;
