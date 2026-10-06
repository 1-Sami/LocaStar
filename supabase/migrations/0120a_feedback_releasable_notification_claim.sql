-- Reconstructed 2026-10-06 from supabase_migrations.schema_migrations.
--
-- Applied to the live database on 2026-08-26 and never written to a file. The
-- SQL below is the copy Postgres kept, verbatim. See CLAUDE.md.
--
-- ## What it is for
--
-- notify-feedback claims rows by stamping notified_at, mails a digest, and must
-- be able to put the claim BACK when the mail fails — otherwise the next sweep
-- skips those rows forever and the digest is lost silently. That is what
-- release_feedback_notifications exists for, and the edge function calls it on
-- every path that does not send.
--
-- The revokes here were the first attempt and were not enough on their own:
-- `revoke from public` leaves a grant made to a named role untouched, which
-- 0121a had to fix an hour later.

drop function if exists public.claim_unnotified_feedback();

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
  select claimed.id, claimed.category, claimed.message, claimed.app_release,
         claimed.platform, claimed.created_at
  from claimed
  order by claimed.created_at;
$function$;

revoke all on function public.claim_unnotified_feedback() from public;
grant execute on function public.claim_unnotified_feedback() to service_role;

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

revoke all on function public.release_feedback_notifications(uuid[]) from public;
grant execute on function public.release_feedback_notifications(uuid[]) to service_role;
