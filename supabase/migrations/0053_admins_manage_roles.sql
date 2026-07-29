-- Granting Superuser silently did nothing: the only UPDATE policy on profiles
-- is "users update own profile" (auth.uid() = id), so an admin editing someone
-- else's row matched no policy and updated 0 rows without raising an error.
-- 0040 added the guard against self-escalation but never gave admins a way to
-- legitimately change anyone's role.
create policy "admins update any profile" on profiles
  for update using (is_admin()) with check (is_admin());

-- With that policy an admin could also rewrite another person's username,
-- avatar or bio, which is well beyond role management. Restrict an admin
-- acting on someone else's profile to the role column only.
create or replace function prevent_self_role_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- End users can never change any role, including their own.
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not is_admin() then
    new.role := old.role;
  end if;

  -- Admins acting on somebody else may change the role and nothing else.
  if auth.uid() is not null and auth.uid() <> old.id and is_admin() then
    new.id := old.id;
    new.username := old.username;
    new.display_name := old.display_name;
    new.avatar_url := old.avatar_url;
    new.bio := old.bio;
    new.locale := old.locale;
    new.theme_preference := old.theme_preference;
    new.home_address := old.home_address;
    new.notification_preferences := old.notification_preferences;
    new.created_at := old.created_at;
  end if;

  return new;
end;
$$;
