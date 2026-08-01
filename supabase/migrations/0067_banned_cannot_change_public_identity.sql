-- A restricted account could still rewrite its own profile. That mattered
-- because a profile is not just a settings page: username, display name,
-- avatar and bio are stamped on every review, location and list the account
-- ever posted, and all of that stays visible during a ban. So a ban stopped
-- new posts while leaving a channel that republishes to every page the old
-- posts appear on — the same shape of hole as editing an existing review
-- (0064), reached from a different direction.
--
-- Blocking the whole profile would be heavy-handed, though. The owner would
-- rather restricted users kept control of their account, and most of a profile
-- is nobody else's business: home address, theme, locale, notification
-- preferences. None of that is visible to another user, so none of it can be
-- used to get at anyone.
--
-- So the line is drawn at visibility, not at the table: while restricted, the
-- four publicly-displayed identity fields are frozen and everything else stays
-- editable.
--
-- This raises rather than silently reverting. The established guard in this
-- schema (prevent_self_role_change, restrict_creator_location_update) pins the
-- column back to its old value and returns success, which is why a banned
-- creator's rename reported "1 row updated" and changed nothing — invisible,
-- and impossible for the app to report. Raising lets restrictionMessage() in
-- the client turn it into "Your account is restricted", which is the truth.
--
-- auth.uid() is null only for service_role, psql and migrations, which bypass
-- RLS by design — see 0043, where guarding those broke appointing the first
-- superuser. Moderators are exempt for the same reason as in 0064: a moderator
-- editing someone is not the restricted party.

create or replace function public.restrict_banned_profile_edit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or is_moderator() or not is_banned() then
    return new;
  end if;

  if new.username is distinct from old.username
     or new.display_name is distinct from old.display_name
     or new.avatar_url is distinct from old.avatar_url
     or new.bio is distinct from old.bio then
    raise exception 'Account is restricted: public profile details cannot be changed'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists restrict_banned_profile_edit on public.profiles;
create trigger restrict_banned_profile_edit
before update on public.profiles
for each row execute function public.restrict_banned_profile_edit();
