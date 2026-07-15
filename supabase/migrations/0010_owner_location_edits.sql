-- The old "owners edit own pending locations" policy required status =
-- 'pending', but locations go live as 'active' immediately now (see
-- 0006), so owners could never actually edit their own submissions.
-- Fix: let owners update their own location regardless of status, but
-- protect the status column itself with a trigger so an owner can't use
-- this to silently un-flag/un-remove their own listing — only admins
-- (via the moderation tools) can change status.

drop policy "owners edit own pending locations" on locations;
create policy "owners edit own locations" on locations
  for update using (created_by = auth.uid() or is_admin())
  with check (created_by = auth.uid() or is_admin());

create or replace function prevent_owner_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status and not is_admin() then
    new.status := old.status;
  end if;
  return new;
end;
$$;

create trigger locations_prevent_status_change
  before update on locations
  for each row execute function prevent_owner_status_change();
