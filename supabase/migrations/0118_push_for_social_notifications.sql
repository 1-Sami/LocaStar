-- Friend requests, friend acceptances, location shares, list shares and role
-- grants have always written a row to `notifications`, so they showed up on
-- the bell icon — but nothing ever pushed. Only activity reminders got that
-- half, because claim_activity_reminders() writes the notification row *and*
-- returns a push claim in one statement. These five types were never wired to
-- anything past the insert, so the recipient only found out by opening the
-- app. Confirmed on a physical iPhone 2026-08-24: sharing a location and
-- sending a friend request produced the in-app row and no push.
--
-- Same shape as activity reminders, minus the trigger-time claim: the insert
-- already happened, in five different trigger functions, so this adds a
-- `pushed_at` marker and a claim function that sweeps whatever is still null,
-- the same "claim marks it, a crash after that loses rather than double
-- sends" property claim_activity_reminders() already has.

alter table public.notifications add column if not exists pushed_at timestamptz;

-- Only the types a person is not already looking at the app for. A daily
-- digest sweep is fine for a reminder about tomorrow; a friend request wants
-- to feel closer to real time, which is why the schedule below runs every two
-- minutes rather than once a day.
create or replace function public.claim_pending_notification_pushes()
returns table (
  push_token text,
  platform text,
  type text,
  payload jsonb,
  locale text
)
language sql
security definer
set search_path to 'public'
as $function$
  with claimed as (
    update notifications
    set pushed_at = now()
    where pushed_at is null
      and type in ('friend_request', 'friend_accepted', 'share', 'list_share', 'role_granted')
      -- A push that arrives after the recipient has already read the
      -- notification in-app (opened the app between the trigger firing and
      -- this sweep picking it up) tells them nothing they don't know.
      and read_at is null
    returning id, user_id, type, payload
  )
  select dt.token, dt.platform, c.type, c.payload, coalesce(p.locale, 'en')
  from claimed c
  join profiles p on p.id = c.user_id
  join device_tokens dt on dt.user_id = c.user_id;
$function$;

revoke all on function public.claim_pending_notification_pushes() from public;
grant execute on function public.claim_pending_notification_pushes() to service_role;

select cron.schedule(
  'send-social-notification-pushes',
  '*/2 * * * *',
  $cron$
    select net.http_post(
      url := 'https://qjhyxbfdmkegpjetnpbo.supabase.co/functions/v1/send-social-notification-pushes',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqaHl4YmZkbWtlZ3BqZXRucGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDYxODAsImV4cCI6MjA5OTUyMjE4MH0.pVPwVbEfh_kipmpBg60niW-eAcevowLFJ-OqkIWS60E'
      ),
      body := '{}'::jsonb
    );
  $cron$
);
