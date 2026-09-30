-- The campaign follows the account where there is one, and the device otherwise.
--
-- 0153 keyed progress on the push token, which is what let a device with no
-- account take part at all. The cost showed up the first time somebody signed
-- out: the token row is deleted on sign-out, tester_nudge_sends cascaded with
-- it, and the new token started again at day one. The owner's own phone did
-- exactly that and is now a day behind everyone else.
--
-- Keying purely on the account would be worse, and in the one place that
-- matters most. Day 1 says "create an account". A device that does what it is
-- told would change key at that moment — from token to user — and be sent
-- straight back to day 1 for complying. The whole point of the anonymous path
-- is to reach people before they sign up, so the transition out of it has to be
-- free.
--
-- So: a subject is 'user:<uuid>' when somebody is signed in and 'token:<token>'
-- when nobody is, and the count spans **both** of a device's possible subjects.
-- Signing in mid-campaign carries the anonymous days forward; signing out and
-- back in keeps the account's days; a reinstall keeps them too.
--
-- The foreign key to device_tokens goes with it. It was the cascade that
-- destroyed the history in the first place, and history that survives the
-- device is the entire point of this change.
--
-- Sharing a phone still behaves: two accounts on one handset have two user
-- subjects, and only the days from the genuinely unclaimed anonymous period are
-- common to both — which is correct, because nobody owned them.

create table if not exists public.tester_nudge_sends_v2 (
  -- 'user:<uuid>' or 'token:<ExponentPushToken[...]>'
  subject text not null,
  day smallint not null,
  sent_at timestamptz not null default now(),
  primary key (subject, day)
);

alter table public.tester_nudge_sends_v2 enable row level security;
-- No policies. Only the sender touches this, as service_role.

-- Carry what has been sent across, resolving each token to its owner where it
-- has one. Grouped, because a person with two Android devices has two rows for
-- the same day and the new key has room for one.
insert into public.tester_nudge_sends_v2 (subject, day, sent_at)
select
  case
    when dt.user_id is not null then 'user:' || dt.user_id::text
    else 'token:' || s.token
  end,
  s.day,
  min(s.sent_at)
from public.tester_nudge_sends s
left join public.device_tokens dt on dt.token = s.token
group by 1, s.day
on conflict (subject, day) do nothing;

drop table public.tester_nudge_sends;
alter table public.tester_nudge_sends_v2 rename to tester_nudge_sends;

/*
 * sadek2 received day 1 on 29 September and the record went with the token.
 *
 * Recorded here rather than left to heal, because the alternative is the
 * owner's phone showing "Dag 1 av 15" while every other tester sees day 2 —
 * and the row is simply true: the notification was delivered.
 */
insert into public.tester_nudge_sends (subject, day, sent_at)
select 'user:' || p.id::text, 1, timestamptz '2026-09-29 11:30:00+02'
from public.profiles p
where p.username = 'sadek2'
on conflict (subject, day) do nothing;

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
set search_path = public
as $$
  with clock as (
    select
      (now() at time zone 'Europe/Stockholm')::date as today,
      (now() at time zone 'Europe/Stockholm')::time as local_time,
      extract(isodow from now() at time zone 'Europe/Stockholm')::int as isodow
  ),
  -- Every Android install is a tester: the app is not in production on Play,
  -- so the closed test is the only way onto an Android device.
  devices as (
    select
      dt.token,
      case
        when dt.user_id is not null then 'user:' || dt.user_id::text
        else 'token:' || dt.token
      end as subject,
      -- The subject this device *would* have had before anybody signed in on
      -- it. Counting it too is what makes creating an account free.
      'token:' || dt.token as anon_subject
    from device_tokens dt
    where dt.platform = 'android'
  ),
  subjects as (
    select d.subject, min(d.anon_subject) as anon_subject
    from devices d
    group by d.subject
  ),
  counted as (
    select
      s.subject,
      ((
        select count(distinct x.day)
        from tester_nudge_sends x
        where x.subject in (s.subject, s.anon_subject)
      ) + 1)::smallint as next_day,
      exists (
        select 1 from tester_nudge_sends x
        cross join clock c
        where x.subject in (s.subject, s.anon_subject)
          and (x.sent_at at time zone 'Europe/Stockholm')::date = c.today
      ) as had_one_today
    from subjects s
  ),
  in_slot as (
    select cn.subject, cn.next_day as day
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
    insert into tester_nudge_sends (subject, day)
    select i.subject, i.day from in_slot i
    on conflict (subject, day) do nothing
    returning tester_nudge_sends.subject, tester_nudge_sends.day
  )
  select
    d.token,
    'android'::text,
    c.day,
    -- Composed, never stored: the counter is derived from the row it belongs to
    -- and so cannot drift from it.
    'Dag ' || c.day || ' av 15',
    n.task
  from claimed c
  join tester_nudge_days n on n.day = c.day
  -- Both of somebody's Android devices should buzz, so one claimed subject may
  -- widen into two rows here. The claim itself is still one per day.
  join devices d on d.subject = c.subject;
$$;

revoke all on function public.claim_tester_nudges() from public, anon, authenticated;
grant execute on function public.claim_tester_nudges() to service_role;
