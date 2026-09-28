-- Day N is the Nth nudge actually sent, not the Nth day since enrolling.
--
-- 0150 counted from a `day_one` date stamped the first time somebody was seen
-- with an Android token, and that is wrong in a way that only shows up on the
-- first night. The job runs every half hour, so it enrols the moment it is
-- switched on — which will almost never be inside a send window. Turning it on
-- at 22:41 stamps day_one as today, sends nothing, and then tomorrow is day
-- *two*. Day one is skipped, permanently, and the thank-you that opens the
-- campaign is the message nobody ever gets.
--
-- Counting sends instead of days removes the whole class of problem:
--
--   next day = (how many nudges this person has had) + 1
--
-- Now enrolling outside a window costs nothing, a missed cron run costs
-- nothing, and pausing the campaign for a week costs nothing — everyone still
-- receives all fifteen, in order, starting at one. The campaign stretches
-- rather than skips, which is the right failure: the fifteen messages are a
-- sequence, and the calendar was never the point.
--
-- "One a day" is then enforced directly, by asking whether this person has had
-- one already today in Europe/Stockholm — rather than falling out of the
-- arithmetic as a side effect, which is how the bug hid.
--
-- tester_nudges goes with it. It existed only to hold day_one, and the first
-- send now serves as the enrolment record. It is empty; nothing has run.

drop table if exists public.tester_nudges;

create or replace function public.claim_tester_nudges()
returns table (
  push_token text,
  device_platform text,
  nudge_day smallint,
  nudge_title text,
  nudge_body text
)
language sql
security definer
set search_path to 'public'
as $$
  with clock as (
    select
      (now() at time zone 'Europe/Stockholm')::date as today,
      (now() at time zone 'Europe/Stockholm')::time as local_time,
      extract(isodow from now() at time zone 'Europe/Stockholm')::int as isodow
  ),
  -- Every Android token is a tester: the app is not in production on Play, so
  -- the closed test is the only way onto an Android device.
  testers as (
    select distinct dt.user_id from device_tokens dt where dt.platform = 'android'
  ),
  counted as (
    select
      t.user_id,
      ((select count(*) from tester_nudge_sends s where s.user_id = t.user_id) + 1)::smallint as next_day,
      exists (
        select 1 from tester_nudge_sends s
        where s.user_id = t.user_id
          and (s.sent_at at time zone 'Europe/Stockholm')::date = c.today
      ) as had_one_today
    from testers t
    cross join clock c
  ),
  in_slot as (
    select cn.user_id, cn.next_day as day
    from counted cn
    cross join clock c
    where cn.next_day between 1 and 15
      and not cn.had_one_today
      and case
            -- Saturday and Sunday: late morning, when nobody is at work.
            when c.isodow in (6, 7)
              then c.local_time >= time '11:30' and c.local_time < time '12:00'
            -- Odd days late morning, even days after work, so fifteen days of
            -- this do not all land at the same moment of the same routine.
            when cn.next_day % 2 = 1
              then c.local_time >= time '11:30' and c.local_time < time '12:00'
            else c.local_time >= time '17:00' and c.local_time < time '17:30'
          end
  ),
  claimed as (
    insert into tester_nudge_sends (user_id, day)
    select s.user_id, s.day from in_slot s
    on conflict (user_id, day) do nothing
    returning tester_nudge_sends.user_id, tester_nudge_sends.day
  )
  select
    dt.token,
    dt.platform,
    c.day,
    -- Composed, never stored: the counter is derived from the row it belongs to
    -- and so cannot drift from it.
    'Dag ' || c.day || ' av 15',
    n.task
  from claimed c
  join tester_nudge_days n on n.day = c.day
  -- Both of somebody's Android devices should buzz, so this join may widen a
  -- claimed row into two. The claim is still one per person per day.
  join device_tokens dt on dt.user_id = c.user_id and dt.platform = 'android';
$$;

revoke all on function public.claim_tester_nudges() from public, anon, authenticated;
grant execute on function public.claim_tester_nudges() to service_role;
