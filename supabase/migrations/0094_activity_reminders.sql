-- Who to remind, the day before an activity they saved.
--
-- The whole decision lives here rather than in the edge function: which
-- activities are due, who saved them, who still wants reminders, and who has
-- already been told. The function that sends is then only a transport — it
-- takes a list of tokens and posts them to Expo. Keeping the rules in SQL means
-- they can be proved with a rolled-back probe instead of by sending real
-- notifications to real phones.

-- One row per person per activity, so nobody is reminded twice.
--
-- Without this, a job that runs hourly would send the same reminder twenty-four
-- times. The primary key is the dedupe: claiming is an insert, and an insert
-- that conflicts returns nothing.
create table if not exists public.activity_reminder_sends (
  location_id uuid not null references public.locations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (location_id, user_id)
);

alter table public.activity_reminder_sends enable row level security;
-- Deliberately no policies. Only the edge function touches this, as
-- service_role, which bypasses RLS. Nobody else has any business reading who
-- has been sent what.

/*
 * Claims the reminders that are due and returns where to send them.
 *
 * Claiming and returning in one statement is the point. The insert marks each
 * reminder as sent *before* the edge function tries to deliver it, so a crash
 * mid-run loses a reminder rather than sending it twice — and for a
 * notification that is the right way round. A duplicate buzz at seven in the
 * morning is worse than a missed one.
 *
 * "Tomorrow" is a local day in Europe/Stockholm, not a 24-hour window. Since
 * migration 0092 pinned starts_at to local midnight, an activity on the 12th
 * begins at 00:00 on the 12th, and the reminder should go out on the 11th
 * whatever hour the job happens to run.
 *
 * user_bans is read directly rather than through is_banned(). That function
 * branches on the caller's JWT role, and a banned user would slip through when
 * it is called from a context it was not written for — which is the fault
 * migration 0078 exists to fix. This function must not care who calls it.
 */
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
      -- A profile created before migration 0093 has no reminders key; treating
      -- that as opted in matches the default the column now carries.
      and coalesce((p.notification_preferences ->> 'reminders')::boolean, true)
      and not exists (
        select 1 from user_bans ub
        where ub.user_id = s.user_id
          and ub.status in ('pending', 'active')
          and (ub.expires_at is null or ub.expires_at > now())
      )
      -- Saving something once does not entitle you to hear about it forever:
      -- a private activity that is no longer shared with you goes quiet.
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

-- Only the edge function, which runs as service_role. An ordinary caller has no
-- reason to be able to mark reminders as sent.
revoke all on function public.claim_activity_reminders() from public, anon, authenticated;
grant execute on function public.claim_activity_reminders() to service_role;
