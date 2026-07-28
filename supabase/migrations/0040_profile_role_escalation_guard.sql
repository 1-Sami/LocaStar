-- The "users update own profile" policy allows updating the whole row, with no
-- column restriction — so any signed-in user could set their own role to
-- 'admin' via a single PostgREST PATCH and gain moderation powers.
--
-- Guard the role column with a trigger, mirroring prevent_owner_status_change()
-- on locations (0010): a non-admin's attempt to change role is silently reverted
-- rather than erroring, so ordinary profile saves keep working unchanged.
create or replace function prevent_self_role_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and not is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_change on profiles;
create trigger profiles_prevent_role_change
  before update on profiles
  for each row execute function prevent_self_role_change();
