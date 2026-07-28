-- 0010 added a trigger stopping location owners from changing their own status
-- (so they can't un-flag or un-remove their listing). It gates on is_admin(),
-- which now silently blocks superusers — the tier whose whole job is flagging
-- and removing reported locations. Their RLS policy allows the update, but the
-- trigger quietly reverted it.
--
-- Allow the moderation tier, and backend contexts with no auth.uid(), the same
-- way 0043 does for role changes.
create or replace function prevent_owner_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and auth.uid() is not null
     and not is_moderator() then
    new.status := old.status;
  end if;
  return new;
end;
$$;
