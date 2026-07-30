-- Handled reports only recorded a status (dismissed/actioned). Which action the
-- moderator actually chose was *inferred* in the app from the content's current
-- status, which is both lossy and wrong: a warning left the content visible, so
-- it read back as "Dismissed", and nothing recorded why the moderator acted.
--
-- Store the chosen action and the moderator's own note on the report, and put
-- both in the audit log so the record shows what was done and why.

alter table location_reports
  add column if not exists resolution_action text,
  add column if not exists resolution_note text;

alter table review_reports
  add column if not exists resolution_action text,
  add column if not exists resolution_note text;

-- Keep the vocabulary closed so the log stays readable.
alter table location_reports drop constraint if exists location_reports_resolution_action_check;
alter table location_reports add constraint location_reports_resolution_action_check
  check (resolution_action is null or resolution_action in ('dismissed', 'warned', 'hidden', 'removed'));

alter table review_reports drop constraint if exists review_reports_resolution_action_check;
alter table review_reports add constraint review_reports_resolution_action_check
  check (resolution_action is null or resolution_action in ('dismissed', 'warned', 'hidden', 'removed'));

-- Carry the action and note into the audit log. Fires when the report is
-- resolved, same as before, but now records the decision itself rather than
-- just the status transition.
create or replace function public.log_report_resolution()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status is distinct from old.status then
    perform log_moderation_action('report_resolved', tg_argv[0], new.id,
      jsonb_build_object(
        'from', old.status,
        'to', new.status,
        'action', new.resolution_action,
        'note', new.resolution_note
      ));
  end if;
  return new;
end;
$function$;
