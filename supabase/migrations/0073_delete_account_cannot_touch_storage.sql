-- 0071 added an avatar cleanup to delete_own_account():
--
--   delete from storage.objects where bucket_id = 'media' and owner = me ...
--
-- Supabase forbids that outright:
--
--   42501: Direct deletion from storage tables is not allowed.
--          Use the Storage API instead.
--
-- So 0071 didn't just fail to delete the avatar, it broke account deletion
-- entirely — the exception aborts the whole function, so the auth.users delete
-- never runs. Deleting an account went from "fails for contributors" (the bug
-- 0071 set out to fix) to "fails for everyone", which is worse.
--
-- It got through because the probe for 0071 exercised `delete from auth.users`
-- rather than delete_own_account() itself, so it never executed the one
-- statement that was new. Verifying the underlying behaviour is not the same
-- as verifying the entry point the app actually calls.
--
-- Storage stays out of here. The avatar still has to go — it is a picture of a
-- person and outliving the account is the whole problem — but it has to go
-- through the Storage API, which means the client removes it just before
-- calling this. See settings/delete-account.tsx.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in';
  end if;

  -- Deliberately nothing else: everything that should disappear with the
  -- account is handled by ON DELETE CASCADE from profiles, and everything that
  -- should outlive it unattributed by ON DELETE SET NULL (both set in 0071).
  delete from auth.users where id = me;
end;
$$;
