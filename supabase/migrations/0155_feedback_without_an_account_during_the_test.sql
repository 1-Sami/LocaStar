-- ⚠ TEMPORARY. Turn this off when Google Play grants production access.
--
--     update app_flags set enabled = false where flag = 'anonymous_feedback';
--
-- That one statement is the whole revert. Nothing to redeploy, nothing to
-- republish — which is the point: a change that must be undone later should be
-- undoable by someone who has forgotten why it exists.
--
-- ## Why
--
-- Feedback required an account, and 0120 said so deliberately: the account
-- requirement *was* the spam defence. But five of the twelve closed testers have
-- installed the app and never signed up, and they are the people whose silence
-- is sinking the production-access application. Asking somebody to create an
-- account before they can tell you why they did not create an account is a
-- closed loop. One tester hit exactly that this week and had to report it by
-- other means.
--
-- ## What this is not
--
-- It is not safe in the adversarial sense, and it should not be described that
-- way. A signed-out caller has no auth.uid(); PostgREST hides the real client
-- IP behind its proxy, so inet_client_addr() is useless; and any identity the
-- client supplies, it can forge. There is no control here that a determined
-- spammer cannot walk through.
--
-- What makes it an acceptable trade *for now* is the blast radius, not the
-- defence: feedback is private, batched into a digest, and deleting a junk row
-- is one statement. The real protection is that this is reversible and that
-- somebody is watching. Neither of those survives a public launch, which is why
-- the flag exists.
--
-- ## The guards that are here
--
--   * a minimum message length, so an empty submission is refused — today the
--     message is trimmed and then inserted however short it is, including blank
--   * ten anonymous messages an hour, counted across the whole app rather than
--     per device, because a per-device cap keyed on something the client sends
--     is theatre: it reads as a control and stops nobody who means it
--
-- Signed-in behaviour is unchanged: ban check, five a day, as before.

create table if not exists public.app_flags (
  flag text primary key,
  enabled boolean not null,
  -- Not decoration. A flag whose purpose is forgotten never gets turned off.
  note text not null
);

alter table public.app_flags enable row level security;
-- No policies, like feedback_throttle: nothing reaches this over PostgREST in
-- either direction. Only the security definer function below reads it.

insert into public.app_flags (flag, enabled, note) values (
  'anonymous_feedback',
  true,
  'Closed test only. TURN OFF when Google Play grants production access — see migration 0155 and CLAUDE.md.'
)
on conflict (flag) do nothing;

/*
 * Which messages arrived without an account.
 *
 * Needed to count them for the hourly cap, and worth having on its own: a note
 * from somebody who has not signed up is the more interesting one, because they
 * are the harder person to hear from.
 */
alter table public.feedback add column if not exists anonymous boolean not null default false;

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
  caller      uuid := auth.uid();
  used        integer;
  recent      integer;
  allow_anon  boolean;
begin
  -- A backstop, not the real check — the app refuses a short message before it
  -- gets here. This one only ever fires for something calling the API directly.
  if length(btrim(coalesce(p_message, ''))) < 5 then
    raise exception 'feedback_too_short' using errcode = '22023';
  end if;

  if caller is null then
    select f.enabled into allow_anon from app_flags f where f.flag = 'anonymous_feedback';

    -- Absent flag reads as off. The safe direction for a row that might have
    -- been deleted by somebody tidying up.
    if not coalesce(allow_anon, false) then
      raise exception 'Sign in to send feedback' using errcode = '42501';
    end if;

    select count(*) into recent
    from feedback f
    where f.anonymous and f.created_at > now() - interval '1 hour';

    -- 54000 is what the app already maps to "you have sent a few already".
    if recent >= 10 then
      raise exception 'feedback_daily_limit' using errcode = '54000';
    end if;

    insert into feedback (category, message, app_release, platform, anonymous)
    values (p_category, btrim(p_message), p_app_release, p_platform, true);
    return;
  end if;

  if is_banned() then
    raise exception 'Sign in to send feedback' using errcode = '42501';
  end if;

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

  if used > 5 then
    raise exception 'feedback_daily_limit' using errcode = '54000';
  end if;

  insert into feedback (category, message, app_release, platform, anonymous)
  values (p_category, btrim(p_message), p_app_release, p_platform, false);
end;
$function$;

-- anon joins authenticated. Revoking from public first, because anon and
-- authenticated hold grants of their own on a replaced function.
revoke all on function public.submit_feedback(text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_feedback(text, text, text, text) to anon, authenticated;
