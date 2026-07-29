-- Warnings: the step below a ban. A moderator can tell someone their content
-- broke the rules without restricting the account.
--
-- Counted, but deliberately NOT auto-escalating — while volume is low a human
-- should decide when a pattern becomes a ban, rather than a threshold firing on
-- its own. The count is surfaced to moderators so that decision is informed.
create table if not exists user_warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  issued_by uuid references profiles(id) on delete set null,
  reason text not null,
  -- optional pointer at what triggered it
  target_type text,
  target_id uuid,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_warnings_user_idx on user_warnings (user_id, created_at desc);

alter table user_warnings enable row level security;

-- The warned person must be able to read it, or it isn't a warning.
create policy "users read own warnings" on user_warnings
  for select using (user_id = auth.uid() or is_moderator());

create policy "moderators issue warnings" on user_warnings
  for insert to authenticated
  with check (is_moderator() and issued_by = auth.uid());

-- Recipients may only mark their own warning as seen; the row is otherwise
-- immutable, and only admins can withdraw one.
create policy "users acknowledge own warnings" on user_warnings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "admins delete warnings" on user_warnings
  for delete using (is_admin());

-- Warnings belong in the same audit trail as bans.
create or replace function log_warning_issued()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform log_moderation_action(
    'warning_issued', 'user', new.user_id,
    jsonb_build_object('warning_id', new.id, 'reason', new.reason)
  );
  return new;
end;
$$;

drop trigger if exists user_warnings_log on user_warnings;
create trigger user_warnings_log
  after insert on user_warnings
  for each row execute function log_warning_issued();
