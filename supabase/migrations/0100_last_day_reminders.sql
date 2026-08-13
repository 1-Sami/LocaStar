-- A second reminder on the final morning, and a language to send both in.
--
-- Two changes that have to happen together, because they touch the same claim.
--
-- 1. THE LAST DAY. One heads-up the day before an activity starts is not
--    enough for something that runs for five days — by the time the last day
--    comes round, the reminder was most of a week ago. So a multi-day activity
--    now also gets "today is the last day", sent on that morning.
--
--    Only multi-day. A one-day activity was already announced yesterday, and
--    two notifications for one afternoon is nagging rather than helpful.
--
-- 2. THE LANGUAGE. The push body was a hardcoded English sentence in the edge
--    function, so a Swedish user got an English notification. The server had no
--    way to do better: profiles.locale exists but the app never wrote to it —
--    the language lived only in AsyncStorage on the device. The app now
--    persists it, and the claim hands it to the sender.
--
-- The primary key is the part that would have bitten. It was
-- (location_id, user_id), which is what stops anyone being reminded twice — and
-- would therefore have let the start reminder permanently block the last-day
-- one, silently and with no error. The kind is now part of it.
--
-- Safe to restructure: the table is empty, checked before writing this.

alter table public.activity_reminder_sends
  add column if not exists kind text not null default 'start';

alter table public.activity_reminder_sends
  drop constraint if exists activity_reminder_sends_kind_check;
alter table public.activity_reminder_sends
  add constraint activity_reminder_sends_kind_check check (kind in ('start', 'last_day'));

alter table public.activity_reminder_sends
  drop constraint if exists activity_reminder_sends_pkey;
alter table public.activity_reminder_sends
  add primary key (location_id, user_id, kind);

-- The return type gains two columns, so this cannot be replaced in place.
-- Dropping resets the grants, and Supabase's defaults would hand EXECUTE to
-- anon and authenticated on the way back — which would be the worst version of
-- that mistake in this repo: the function claims reminders (burning them for
-- everyone) and returns push tokens. It is service_role only, as before.
drop function if exists public.claim_activity_reminders();

create function public.claim_activity_reminders()
returns table (
  push_token text,
  platform text,
  location_id uuid,
  activity_name text,
  starts_at timestamptz,
  kind text,
  locale text
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
        at time zone 'Europe/Stockholm' as tomorrow_end,
      date_trunc('day', now() at time zone 'Europe/Stockholm')                  as today_local
  ),
  -- Everyone who could be told anything about anything, before we decide which
  -- reminder they are due. Keeping the eligibility rules in one place means the
  -- ban check, the preference check and the visibility check cannot drift
  -- between the two kinds.
  eligible as (
    select s.user_id, l.id as location_id, l.name, l.starts_at, l.expires_at
    from locations l
    join saves s on s.location_id = l.id
    join profiles p on p.id = s.user_id
    where l.kind = 'activity'
      and l.status = 'active'
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
  due as (
    select distinct e.user_id, e.location_id, e.name, e.starts_at, 'start' as kind
    from eligible e
    cross join bounds b
    where e.starts_at >= b.tomorrow_start
      and e.starts_at <  b.tomorrow_end

    union all

    select distinct e.user_id, e.location_id, e.name, e.starts_at, 'last_day' as kind
    from eligible e
    cross join bounds b
    where e.expires_at is not null
      -- Ends today, in Stockholm terms.
      and date_trunc('day', e.expires_at at time zone 'Europe/Stockholm') = b.today_local
      -- Multi-day only: a single-day activity was announced yesterday.
      and date_trunc('day', e.expires_at at time zone 'Europe/Stockholm')
        > date_trunc('day', e.starts_at at time zone 'Europe/Stockholm')
      -- Already started, and not over yet.
      and e.starts_at <= now()
      and e.expires_at > now()
  ),
  claimed as (
    insert into activity_reminder_sends (location_id, user_id, kind)
    select d.location_id, d.user_id, d.kind from due d
    on conflict (location_id, user_id, kind) do nothing
    returning location_id, user_id, kind
  ),
  noted as (
    insert into notifications (user_id, type, payload)
    select
      c.user_id,
      'activity_reminder',
      jsonb_build_object(
        'location_id', c.location_id,
        'location_name', d.name,
        'starts_at', d.starts_at,
        'kind', c.kind
      )
    from claimed c
    join due d
      on d.location_id = c.location_id and d.user_id = c.user_id and d.kind = c.kind
    returning 1
  )
  select dt.token, dt.platform, c.location_id, d.name, d.starts_at, c.kind,
         coalesce(p.locale, 'en')
  from claimed c
  join due d
    on d.location_id = c.location_id and d.user_id = c.user_id and d.kind = c.kind
  join profiles p on p.id = c.user_id
  join device_tokens dt on dt.user_id = c.user_id;
$function$;

revoke all on function public.claim_activity_reminders() from public, anon, authenticated;
grant execute on function public.claim_activity_reminders() to service_role;
