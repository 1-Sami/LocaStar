-- Fifteen days of one small nudge, to the Android testers only.
--
-- The closed test needs twelve people opted in for fourteen unbroken days, and
-- it needs those people to look like they actually used the app — that second
-- half is what the last application was refused on. This is the second half:
-- one short Swedish notification a day, each asking for one small thing, each
-- saying how many days are left.
--
-- Swedish only, by the owner's instruction. Every tester is family.
--
-- **Android only, and that is the whole targeting rule.** The app is not in
-- production on Play, so the only way onto an Android device is through the
-- closed test — every Android push token in the table belongs to a tester by
-- definition. No enrolment list, no emails to keep in step, and no possibility
-- of this reaching the real iOS users who are on the App Store and did not sign
-- up to be nagged.
--
-- **Notification preferences are deliberately not consulted.** Not an override:
-- the four categories a person can switch off are reviews, shares, marketing
-- and reminders, and a fifteen-day test campaign is none of them. Treating it
-- as marketing would be worse than ignoring it — marketing defaults to *off*,
-- so almost nobody would get these. The owner's call, and no existing switch is
-- made to lie by it.
--
-- Bans are not checked either, unlike claim_activity_reminders. A banned
-- tester's opt-in still counts towards Google's twelve, and this is a nudge
-- about the test rather than content being delivered to them.

-- The copy. One row a day, in the order they go out.
--
-- Its own table rather than a CASE in the function so the owner can rewrite a
-- line with one UPDATE and no migration.
--
-- **The title is not stored.** It is always "Dag N av 15" and is composed when
-- the notification is claimed, so the counter cannot go stale, cannot disagree
-- with the row it sits on, and cannot be broken by editing a task. There is one
-- editable thing per day and it is the sentence the tester reads.
--
-- Day 1 does not simply say "skapa ett konto", though that is the task it is
-- for. A push is addressed to a user_id, so somebody without an account has no
-- device token and this never reaches them — the ask only lands for people who
-- have already done it. Getting the account created belongs in the recruiting
-- message; day 1 covers the case where somebody signed out or stalled halfway.
--
-- The order is not arbitrary. Days 1-4 are the owner's. After that it walks the
-- whole app — search, reviews, adding, directions, categories, sharing, events,
-- achievements, friends — because the production-access form asks whether
-- testers used *all* the features, and fifteen days of one feature each is the
-- answer. Days 4 and 14 both ask for feedback, which fills the inbox the
-- application's third section gets quoted from.
create table if not exists public.tester_nudge_days (
  day smallint primary key check (day between 1 and 15),
  task text not null
);

alter table public.tester_nudge_days enable row level security;
-- No policies. Only the sender reads this, as service_role.

insert into public.tester_nudge_days (day, task) values
  (1,  'Välkommen som testare! Har du inte skapat ett konto än, gör det nu.'),
  (2,  'Skapa en lista och bokmärk dina favoriter.'),
  (3,  'Lägg till en bild på en plats du varit på.'),
  (4,  'Lämna feedback i appen: Profil → Skicka feedback.'),
  (5,  'Sök efter något nära dig — tryck på Sök och sedan Nära mig.'),
  (6,  'Skriv en recension på ett ställe du känner till.'),
  (7,  'Lägg till en plats som saknas på kartan.'),
  (8,  'Öppna en plats och testa Vägbeskrivning.'),
  (9,  'Välj en kategori du inte tittat på än.'),
  (10, 'Dela en plats med någon du känner.'),
  (11, 'Kolla in Evenemang och se vad som händer.'),
  (12, 'Titta på dina utmärkelser under Profil.'),
  (13, 'Lägg till en vän i appen.'),
  (14, 'Vad var sämst med appen? Skriv det i feedbacken.'),
  (15, 'Jag vill ge ett stort tack till dig för att du testat appen. Jag hoppas Google godkänner den nu så den hamnar i Play Store.')
on conflict (day) do nothing;

/*
 * When each tester's fifteen days started.
 *
 * Per person, not one campaign calendar. Testers arrive over a fortnight, and
 * somebody who installs on the tenth day should still be thanked on their first
 * day rather than dropped into the middle of somebody else's countdown. It also
 * matches the rule being satisfied: Google counts fourteen unbroken days *per
 * tester*, so a per-tester countdown is the honest one to show.
 *
 * Filled by the claim below the first time a person appears with an Android
 * token, so there is nothing to maintain by hand.
 */
create table if not exists public.tester_nudges (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  day_one date not null,
  enrolled_at timestamptz not null default now()
);

alter table public.tester_nudges enable row level security;

-- One row per person per day, and the primary key is the dedupe: claiming is an
-- insert, and an insert that conflicts returns nothing. The job runs every half
-- hour, so without this everyone would be buzzed forty-eight times a day.
create table if not exists public.tester_nudge_sends (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day smallint not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.tester_nudge_sends enable row level security;

/*
 * Claims whatever is due this half hour and returns where to send it.
 *
 * Times are the owner's: 11:30 and 17:00, alternating by day, and always 11:30
 * at the weekend. All of it is decided in Europe/Stockholm rather than in the
 * cron expression, because pg_cron runs in UTC and a fixed UTC time silently
 * moves an hour when the clocks change in late October. Postgres knows when
 * that happens; a crontab does not.
 *
 * The job fires every thirty minutes and this function answers "is it that
 * person's slot right now" — so the schedule needs no seasonal editing, and a
 * missed run simply catches the tail of its own window.
 *
 * Claiming and returning in one statement, as claim_activity_reminders does:
 * the send is recorded *before* delivery is attempted, so a crash mid-run loses
 * a nudge rather than sending it twice. For something that buzzes a phone that
 * is the right way round.
 */
-- The output columns are prefixed, and every reference below is qualified.
--
-- In a SQL-language function the RETURNS TABLE names are in scope as
-- parameters, and `day` and `platform` are both real columns of the tables this
-- queries. An unqualified `day` could then resolve to the output parameter
-- rather than the column, silently — which is migration 0077's bug wearing a
-- different hat. Names that cannot collide cost nothing and remove the question.
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
  -- Anyone with an Android token who is not enrolled yet starts today, on day
  -- one. Reading tester_nudges in `everyone` below cannot see these rows — a
  -- statement sees one snapshot — so the RETURNING is unioned in explicitly.
  newly_enrolled as (
    insert into tester_nudges (user_id, day_one)
    select distinct dt.user_id, c.today
    from device_tokens dt
    cross join clock c
    where dt.platform = 'android'
    on conflict (user_id) do nothing
    returning tester_nudges.user_id, tester_nudges.day_one
  ),
  everyone as (
    select tn.user_id, tn.day_one from tester_nudges tn
    union
    select ne.user_id, ne.day_one from newly_enrolled ne
  ),
  due as (
    select e.user_id, ((c.today - e.day_one) + 1)::smallint as day, c.isodow, c.local_time
    from everyone e
    cross join clock c
  ),
  in_slot as (
    select d.user_id, d.day
    from due d
    where d.day between 1 and 15
      and case
            -- Saturday and Sunday: late morning, when nobody is at work.
            when d.isodow in (6, 7)
              then d.local_time >= time '11:30' and d.local_time < time '12:00'
            -- Odd days late morning, even days after work, so fifteen days of
            -- this do not all land at the same moment of the same routine.
            when d.day % 2 = 1
              then d.local_time >= time '11:30' and d.local_time < time '12:00'
            else d.local_time >= time '17:00' and d.local_time < time '17:30'
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

-- Only the edge function, which runs as service_role. Nobody else has any
-- business marking nudges as sent, or reading who has had which.
revoke all on function public.claim_tester_nudges() from public, anon, authenticated;
grant execute on function public.claim_tester_nudges() to service_role;
