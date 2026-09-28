-- Reach the testers who installed the app and never made an account.
--
-- Twelve people are opted in on Play. Four had accounts, so four had push
-- tokens, so four could be reached — and the eight who mattered most, the ones
-- who installed and stopped, were invisible to the very campaign whose first
-- message asks them to sign up. The nudge could only reach people who had
-- already done the thing it was nudging them to do.
--
-- The cause is that a push token was treated as belonging to a person. It does
-- not: an Expo token belongs to the *install*. Getting one has never required
-- an account — only asking the OS — and the account requirement was ours.
--
-- Three changes, and they go together:
--
--   1. device_tokens.user_id becomes nullable, so a device can be known before
--      anybody signs in on it.
--   2. register_device_token accepts an anonymous caller.
--   3. The nudge campaign is keyed on the token rather than the user.
--
-- (3) is the one that matters beyond this campaign. Keying on the token means
-- progress survives the account being created *during* the fifteen days: the
-- install keeps its token when somebody signs in, so day 4 still follows day 3
-- across the very event day 1 asks for. Keyed on user_id it could not, because
-- until then there is no user_id to key on.
--
-- What this still cannot do: reach a phone that never opens the app. An update
-- is fetched at launch, so the JS that registers the token only arrives if the
-- app is run. Nothing about push can get past that, and the people who never
-- open it again need an email rather than a notification.

-- A device with nobody signed in on it. Every existing row keeps its owner.
alter table public.device_tokens alter column user_id drop not null;

/*
 * Register this install for push, signed in or not.
 *
 * Open to anon deliberately. The anon key is public, so this is a place a
 * stranger could write rows — hence the format check, which is the cheap part
 * of the defence. The expensive part is that there is nothing here worth
 * attacking: a junk token buys a rejected ticket from Expo, not a message to
 * anybody, and the rows are only ever read by the two sending jobs.
 *
 * coalesce on conflict, not a straight overwrite: an anonymous re-registration
 * must not blank the owner of a token that somebody has already signed in on.
 * A different person signing in on the same device still takes it over, which
 * is what the original on-conflict was for.
 */
create or replace function public.register_device_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_platform not in ('ios', 'android') then
    raise exception 'unknown platform: %', p_platform;
  end if;

  -- Shape only. It costs one regex and keeps the obvious rubbish out.
  if p_token !~ '^ExponentPushToken\[[A-Za-z0-9_%+.\-]+\]$' then
    raise exception 'not an Expo push token';
  end if;

  -- is_banned() reads the caller's JWT, so it is only meaningful when there is
  -- one. An anonymous device cannot be banned because it is not anybody yet.
  if auth.uid() is not null and is_banned() then
    return;
  end if;

  insert into public.device_tokens (user_id, token, platform)
  values (auth.uid(), p_token, p_platform)
  on conflict (token) do update
    set user_id = coalesce(auth.uid(), device_tokens.user_id),
        platform = excluded.platform,
        updated_at = now();
end;
$$;

revoke all on function public.register_device_token(text, text) from public;
grant execute on function public.register_device_token(text, text) to anon, authenticated;

-- Re-keyed from the person to the install. Empty — nothing has been sent yet.
drop table if exists public.tester_nudge_sends;

create table public.tester_nudge_sends (
  token text not null references public.device_tokens(token) on delete cascade,
  day smallint not null,
  sent_at timestamptz not null default now(),
  primary key (token, day)
);

alter table public.tester_nudge_sends enable row level security;
-- No policies. Only the sender touches this, as service_role.

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
  -- Every Android install, with or without an account behind it. The app is
  -- not in production on Play, so the closed test is the only way onto an
  -- Android device — every one of these is a tester.
  testers as (
    select dt.token from device_tokens dt where dt.platform = 'android'
  ),
  counted as (
    select
      t.token,
      ((select count(*) from tester_nudge_sends s where s.token = t.token) + 1)::smallint as next_day,
      exists (
        select 1 from tester_nudge_sends s
        where s.token = t.token
          and (s.sent_at at time zone 'Europe/Stockholm')::date = c.today
      ) as had_one_today
    from testers t
    cross join clock c
  ),
  in_slot as (
    select cn.token, cn.next_day as day
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
    insert into tester_nudge_sends (token, day)
    select s.token, s.day from in_slot s
    on conflict (token, day) do nothing
    returning tester_nudge_sends.token, tester_nudge_sends.day
  )
  select
    c.token,
    'android'::text,
    c.day,
    -- Composed, never stored: the counter is derived from the row it belongs to
    -- and so cannot drift from it.
    'Dag ' || c.day || ' av 15',
    n.task
  from claimed c
  join tester_nudge_days n on n.day = c.day;
$$;

revoke all on function public.claim_tester_nudges() from public, anon, authenticated;
grant execute on function public.claim_tester_nudges() to service_role;
