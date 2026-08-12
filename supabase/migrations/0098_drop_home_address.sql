-- Drop the home address.
--
-- The column was added in 0005 and never read by anything. The Account screen
-- told people it was "used as a default starting point for nearby searches",
-- which was not true — nothing on Home or Search ever touched it. It was
-- written, hidden from other users by 0066, and read back only so it could be
-- edited.
--
-- Collecting a street address for no purpose is the wrong side of data
-- minimisation, and it is the most sensitive field the app had. Checked before
-- writing this: 0 of 4 profiles had ever set one, so nothing of anyone's is
-- lost here.
--
-- Order matters. Two things reference the column, and dropping it first would
-- leave both compiling fine and failing at runtime — the trigger on every
-- profile update, the RPC on every settings screen load. So they go first and
-- the column goes last.

-- 1. The trigger that pins an admin's edits to somebody else's profile back to
--    the stored values. One fewer column to pin.
create or replace function public.prevent_self_role_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not is_admin() then
    new.role := old.role;
  end if;

  if auth.uid() is not null and auth.uid() <> old.id and is_admin() then
    new.id := old.id;
    new.username := old.username;
    new.display_name := old.display_name;
    new.avatar_url := old.avatar_url;
    new.bio := old.bio;
    new.locale := old.locale;
    new.theme_preference := old.theme_preference;
    new.notification_preferences := old.notification_preferences;
    new.created_at := old.created_at;
  end if;

  return new;
end;
$function$;

-- 2. The self-scoped read of the private columns. Its return type changes, so
--    it has to be dropped and recreated rather than replaced.
--
--    Recreating means the grants are recreated too, and Supabase's default
--    privileges hand EXECUTE to anon and authenticated on every new function.
--    anon did not have it before and must not get it now: this reads a row
--    chosen by auth.uid(), which is null for an anonymous caller. Migration
--    0092 is the same lesson learned on register_device_token.
drop function if exists public.my_private_profile();

create function public.my_private_profile()
returns table (notification_preferences jsonb)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select p.notification_preferences
  from profiles p
  where p.id = auth.uid();
$function$;

revoke all on function public.my_private_profile() from public, anon;
grant execute on function public.my_private_profile() to authenticated, service_role;

-- 3. And the column itself.
alter table public.profiles drop column if exists home_address;
