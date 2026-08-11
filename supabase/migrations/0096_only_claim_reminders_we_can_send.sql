-- Do not claim a reminder for someone who has no device to send it to.
--
-- 0094 inserted a claim for everyone due, then joined device_tokens to work out
-- where to send. Anyone without a token was dropped by that join *after* being
-- marked as reminded — so their reminder was consumed and could never be sent
-- again, not even once they installed the app and registered a token.
--
-- Found by running the edge function rather than by reading the SQL: it
-- returned `claimed: 0` while activity_reminder_sends gained a row for Kultur
-- Festivalen. The probe in 0094 missed it because the probe inserted tokens
-- first, which is exactly the case that works.
--
-- Right now nobody has a token at all, so every reminder would have been
-- swallowed this way.
--
-- The fix is to require a token in `due`, so an untokened user is simply not
-- due yet. Nothing is lost: they become due the moment they register one, as
-- long as it is still the day before.

create or replace function public.claim_activity_reminders()
returns table (
  push_token text,
  platform text,
  location_id uuid,
  activity_name text,
  starts_at timestamptz
)
language sql
security definer
set search_path to 'public'
as $$
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
      -- Somewhere to send it. Without this the claim below burns the reminder
      -- for anyone who has not registered a device yet.
      and exists (select 1 from device_tokens dt where dt.user_id = s.user_id)
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
  )
  select dt.token, dt.platform, c.location_id, d.name, d.starts_at
  from claimed c
  join due d on d.location_id = c.location_id and d.user_id = c.user_id
  join device_tokens dt on dt.user_id = c.user_id;
$$;

-- Release the reminder the broken version swallowed, so it can still go out.
delete from public.activity_reminder_sends;
