-- is_banned(target uuid) is SECURITY DEFINER and executable by `authenticated`,
-- and takes an arbitrary user id. Since `profiles` is world-readable, any
-- signed-in user could enumerate ids and ask /rest/v1/rpc/is_banned whether
-- each one is banned — moderation state about other people.
--
-- Revoking EXECUTE is not an option: all 18 ban-enforcement policies call
-- is_banned() themselves and are evaluated as the querying role, so revoking
-- would break enforcement everywhere. Narrow it inside the function instead,
-- keeping the signature so no policy has to be recreated.
--
-- Every policy calls the no-argument form, which resolves to auth.uid(), so
-- enforcement is unaffected. Only a deliberate lookup about *someone else*
-- changes behaviour, and that now requires being a moderator.

create or replace function public.is_banned(target uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from user_bans
    where user_id = target
      and status in ('pending', 'active')
      and (expires_at is null or expires_at > now())
  )
  and (
    -- No JWT: a trigger, migration or service-role context. Answer truthfully.
    auth.uid() is null
    -- Asking about yourself is fine, and is what every policy does.
    or target = auth.uid()
    -- Moderators legitimately need to see who is restricted.
    or is_moderator()
  );
$function$;
