-- Lists were the one piece of user-generated content nobody could report.
--
-- A list carries a name and a description written by a person, and a public
-- one is on the Home screen and the Community tab where anyone can read it.
-- Locations, reviews and photos all had a report path; this did not, so the
-- only way to act on an abusive list name was to already be a moderator and
-- happen to see it.
--
-- Deliberately a mirror of review_reports rather than a new shape: the admin
-- queue, the resolution actions and the audit trigger all already understand
-- that shape, and a third one would be a third thing to keep in step.

create table if not exists list_reports (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references lists (id) on delete cascade,
  reporter_id uuid not null references profiles (id),
  reason text not null,
  details text,
  status report_status not null default 'open',
  resolution_action text,
  resolution_note text,
  resolved_by uuid references profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint list_reports_resolution_action_check
    check (resolution_action is null or resolution_action in ('dismissed', 'warned', 'hidden', 'removed'))
);

-- The queue reads "everything still open, newest first"; the list_id index is
-- for the other direction, "has this list been reported before".
create index if not exists list_reports_status_idx on list_reports (status, created_at desc);
create index if not exists list_reports_list_idx on list_reports (list_id);

alter table list_reports enable row level security;
grant select, insert, update on list_reports to authenticated;

-- Same three policies review_reports ended up with after 0042 and 0047: your
-- own reports plus every report if you moderate, filing only as yourself and
-- only if you are not banned, resolving only as a moderator.
create policy "reporters and moderators view list reports" on list_reports
  for select using (reporter_id = auth.uid() or is_moderator());

create policy "authenticated users file list reports" on list_reports
  for insert to authenticated
  with check (auth.uid() = reporter_id and not is_banned());

create policy "moderators resolve list reports" on list_reports
  for update using (is_moderator()) with check (is_moderator());

-- Reported content has to stay readable to the person judging it. A public
-- list is readable by everyone anyway, but an owner who flips it private
-- after being reported would otherwise take the evidence with them.
create policy "moderators read every list" on lists
  for select using (is_moderator());

-- Carries the decision into moderation_actions, exactly as the location and
-- review queues do. The argument is the target_type recorded on the row.
drop trigger if exists list_reports_log_resolution on list_reports;
create trigger list_reports_log_resolution
  after update on list_reports
  for each row execute function log_report_resolution('list_report');
