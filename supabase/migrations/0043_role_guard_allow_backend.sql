-- 0040's guard was too broad: it reverts any role change where is_admin() is
-- false, and is_admin() depends on auth.uid(). Backend contexts (service_role,
-- psql, migrations) have no auth.uid(), so legitimate grants were silently
-- reverted too — including appointing the very first superuser.
--
-- Only reject role changes coming from a signed-in end user who isn't an admin.
-- Requests with no auth.uid() can only reach this trigger via service_role,
-- which bypasses RLS by design; ordinary anon requests are already stopped by
-- the "users update own profile" policy (auth.uid() = id can't match null).
create or replace function prevent_self_role_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;
