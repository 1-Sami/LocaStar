-- Somewhere for people to say "I wish it did X".
--
-- The only way to reach us has been mailto:support@locastar.se, which is the
-- *support* channel: account trouble, faults, GDPR requests, ban appeals. It
-- stays exactly as it is — both stores check that the published support URL
-- shows a way to reach a human. What it is bad at is product feedback, which
-- is not a conversation with one person but a pile you read through when
-- deciding what to build next. A pile wants a queue.
--
-- DELIBERATELY ANONYMOUS. There is no user_id column. Signing in is required
-- and then forgotten: the account proves a human bothered to make one, which
-- is the whole reason for the requirement — spam and prank submissions — and
-- it is never attached to the message. Same stance as crash_reports (0110),
-- and it is what keeps the Privacy Policy honest with a single added bullet
-- rather than the policy-and-store-declaration change 0110 refused to make
-- quietly.
--
-- The consequence, accepted on purpose: nobody can be replied to. Anyone who
-- wants an answer uses the support address, where the mail arrives from their
-- own inbox and threads normally. The form says so before they type.

create table if not exists public.feedback (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  -- Stored in English regardless of the sender's language. A Swedish "Önska en
  -- funktion" and an English "Request a feature" are the same category, and
  -- storing the label would leave the queue in two languages and any grouping
  -- by category broken. Same rule report_modal.tsx already follows for reasons.
  category     text not null check (category in ('general', 'feature_request', 'feature_removal')),
  message      text not null check (length(message) between 1 and 2000),
  -- Which build. "Is this still true?" is the first question about any request,
  -- and half of them are about something that has since changed.
  app_release  text not null check (length(app_release) <= 32),
  platform     text not null check (platform in ('ios', 'android', 'web')),
  -- Stamped by the digest sweep so a re-run cannot mail the same row twice.
  notified_at  timestamptz
);

create index if not exists feedback_recent_idx
  on public.feedback (created_at desc);

create index if not exists feedback_unnotified_idx
  on public.feedback (created_at) where notified_at is null;

alter table public.feedback enable row level security;

-- NOTE THE ABSENCE OF AN INSERT POLICY. It is not an oversight and must not be
-- "fixed" by adding one. An insert policy would let the client POST straight to
-- /rest/v1/feedback and skip the throttle below entirely, which is the only
-- thing making the sign-in requirement mean anything. The single way in is
-- submit_feedback().
create policy "admins read feedback"
  on public.feedback for select
  using (is_admin());

-- Admin rather than moderator, unlike crash_reports. A Superuser moderates
-- content; there is no moderation reason to read somebody's opinion about the
-- stat tiles.
create policy "admins clear feedback"
  on public.feedback for delete
  using (is_admin());

-- The spam gate, kept strictly apart from the content.
--
-- A date and a count, never a timestamp. A timestamp here would line up
-- one-to-one with feedback.created_at and re-identify every message in a single
-- join, undoing the whole design above. At day granularity the most this table
-- can say is "this account sent something today", which is exactly enough to
-- rate limit and nothing more.
create table if not exists public.feedback_throttle (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  sent_on    date not null,
  sent_count integer not null
);

-- RLS on with no policies at all: nothing reaches this table over PostgREST,
-- in either direction. Only the security definer function below touches it.
alter table public.feedback_throttle enable row level security;

-- Five a day. Enough that nobody with something to say runs out, few enough
-- that one account cannot bury the queue.
create or replace function public.submit_feedback(
  p_category text,
  p_message text,
  p_app_release text,
  p_platform text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  caller uuid := auth.uid();
  used   integer;
begin
  if caller is null then
    raise exception 'Sign in to send feedback' using errcode = '42501';
  end if;

  -- security definer bypasses RLS, so this check cannot be left to a policy —
  -- and there is no insert policy for it to live in anyway. Without this line
  -- the ban would be decorative.
  if is_banned() then
    raise exception 'Sign in to send feedback' using errcode = '42501';
  end if;

  -- Stockholm rather than UTC: "today" should mean the sender's today.
  insert into feedback_throttle as ft (user_id, sent_on, sent_count)
  values (caller, (now() at time zone 'Europe/Stockholm')::date, 1)
  on conflict (user_id) do update
    set sent_on    = (now() at time zone 'Europe/Stockholm')::date,
        sent_count = case
                       when ft.sent_on = (now() at time zone 'Europe/Stockholm')::date
                       then ft.sent_count + 1
                       else 1
                     end
  returning ft.sent_count into used;

  -- Raising rolls the increment back with it, so a blocked account sits at the
  -- limit rather than climbing forever.
  if used > 5 then
    raise exception 'feedback_daily_limit' using errcode = '54000';
  end if;

  insert into feedback (category, message, app_release, platform)
  values (p_category, btrim(p_message), p_app_release, p_platform);
end;
$function$;

-- `revoke from public` is NOT enough on its own, and believing it was is how
-- this table was briefly readable by anyone signed in.
--
-- Supabase's default privileges grant EXECUTE on every new function in `public`
-- directly to `anon` and `authenticated`. Those are grants to named roles, so
-- revoking PUBLIC leaves them exactly where they were, and the function stays
-- callable at /rest/v1/rpc/<name>. Every role that should not have it has to be
-- named. Checked with has_function_privilege(), not by reading this back.
revoke all on function public.submit_feedback(text, text, text, text) from public, anon;
grant execute on function public.submit_feedback(text, text, text, text) to authenticated;

-- Hands the digest whatever has not been mailed yet and marks it in the same
-- statement, so two overlapping sweeps cannot both mail the same row. Same
-- shape as claim_pending_notification_pushes(), with one addition: the ids come
-- back too, so a failed send can put them back (see below). The rows themselves
-- are never at risk either way — the queue is the record and the mail is only
-- the nudge to go and look at it.
create or replace function public.claim_unnotified_feedback()
returns table (
  id uuid,
  category text,
  message text,
  app_release text,
  platform text,
  created_at timestamptz
)
language sql
security definer
set search_path to 'public'
as $function$
  with claimed as (
    update feedback
    set notified_at = now()
    where notified_at is null
    returning id, category, message, app_release, platform, created_at
  )
  -- Every reference qualified. These names are also the function's output
  -- parameters, and an unqualified `category` in here is ambiguous between the
  -- two — the failure mode migration 0077 documents, where the column silently
  -- wins. claim_pending_notification_pushes() prefixes for the same reason.
  select claimed.id, claimed.category, claimed.message, claimed.app_release,
         claimed.platform, claimed.created_at
  from claimed
  order by claimed.created_at;
$function$;

-- anon and authenticated named explicitly — see the note above submit_feedback.
-- This one matters most of the three: it is SECURITY DEFINER and returns the
-- message text, so a stray grant here hands the whole queue to anyone signed
-- in, straight past the admins-only select policy.
revoke all on function public.claim_unnotified_feedback() from public, anon, authenticated;
grant execute on function public.claim_unnotified_feedback() to service_role;

-- Puts a claim back when the mail did not go out.
--
-- Without this, a Brevo outage silently swallows a digest: the rows are stamped
-- notified, the mail never arrives, and the next sweep skips them forever. The
-- feedback is still in the queue, but the whole point of the mail is that
-- nobody has to remember to open the queue.
create or replace function public.release_feedback_notifications(p_ids uuid[])
returns void
language sql
security definer
set search_path to 'public'
as $function$
  update feedback
  set notified_at = null
  where feedback.id = any(p_ids);
$function$;

revoke all on function public.release_feedback_notifications(uuid[]) from public, anon, authenticated;
grant execute on function public.release_feedback_notifications(uuid[]) to service_role;
