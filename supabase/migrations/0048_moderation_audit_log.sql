-- Immutable record of every moderation action, so a superuser who starts
-- banning people or removing locations without good reason can be held to it.
--
-- Written by triggers rather than by the app on purpose: the client cannot
-- forget to log, and cannot log something different from what it actually did.
-- Nothing has an INSERT policy, so the only writer is the SECURITY DEFINER
-- trigger functions.
create table if not exists moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  actor_role user_role,
  action text not null,
  target_type text not null,
  target_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists moderation_actions_actor_idx on moderation_actions (actor_id, created_at desc);
create index if not exists moderation_actions_target_idx on moderation_actions (target_type, target_id);

alter table moderation_actions enable row level security;

-- Admins audit everyone; superusers can see their own history but cannot
-- alter it. No INSERT/UPDATE/DELETE policy exists for anyone.
create policy "admins read all moderation actions" on moderation_actions
  for select using (is_admin() or actor_id = auth.uid());

create or replace function current_user_role()
returns user_role
language sql
stable security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function log_moderation_action(
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_detail jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into moderation_actions (actor_id, actor_role, action, target_type, target_id, detail)
  values (auth.uid(), current_user_role(), p_action, p_target_type, p_target_id, p_detail);
end;
$$;

-- Location status changes (flag / remove / restore)
create or replace function log_location_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform log_moderation_action(
      'location_status_changed', 'location', new.id,
      jsonb_build_object('from', old.status, 'to', new.status, 'name', new.name)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists locations_log_status_change on locations;
create trigger locations_log_status_change
  after update on locations
  for each row execute function log_location_status_change();

-- Review status changes (hide / remove / restore)
create or replace function log_review_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform log_moderation_action(
      'review_status_changed', 'review', new.id,
      jsonb_build_object('from', old.status, 'to', new.status, 'author', new.user_id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_log_status_change on reviews;
create trigger reviews_log_status_change
  after update on reviews
  for each row execute function log_review_status_change();

-- Bans: both issuing and the admin's validation decision
create or replace function log_ban_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform log_moderation_action(
      'ban_issued', 'user', new.user_id,
      jsonb_build_object('ban_id', new.id, 'status', new.status,
                         'expires_at', new.expires_at, 'reason', new.reason)
    );
  elsif new.status is distinct from old.status then
    perform log_moderation_action(
      'ban_reviewed', 'user', new.user_id,
      jsonb_build_object('ban_id', new.id, 'from', old.status, 'to', new.status,
                         'note', new.review_note)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists user_bans_log_change on user_bans;
create trigger user_bans_log_change
  after insert or update on user_bans
  for each row execute function log_ban_change();

-- Role grants and revocations
create or replace function log_role_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    perform log_moderation_action(
      'role_changed', 'user', new.id,
      jsonb_build_object('from', old.role, 'to', new.role)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_log_role_change on profiles;
create trigger profiles_log_role_change
  after update on profiles
  for each row execute function log_role_change();

-- Report resolutions
create or replace function log_report_resolution()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform log_moderation_action(
      'report_resolved', tg_argv[0], new.id,
      jsonb_build_object('from', old.status, 'to', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists location_reports_log_resolution on location_reports;
create trigger location_reports_log_resolution
  after update on location_reports
  for each row execute function log_report_resolution('location_report');

drop trigger if exists review_reports_log_resolution on review_reports;
create trigger review_reports_log_resolution
  after update on review_reports
  for each row execute function log_report_resolution('review_report');
