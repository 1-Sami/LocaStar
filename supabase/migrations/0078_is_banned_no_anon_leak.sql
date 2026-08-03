-- 0062 stopped a signed-in user enumerating who is banned. It left the same
-- door open for anonymous callers.
--
-- The guard it added reads:
--
--     auth.uid() is null   -- "a trigger, migration or service-role context"
--
-- but `anon` has no `sub` claim either, so auth.uid() is null for every
-- unauthenticated REST request too. `/rest/v1/rpc/is_banned?target=<uuid>` with
-- nothing but the publishable key therefore returned the truth, and `profiles`
-- is world-readable by design, so the ids to ask about are free. Moderation
-- state for every account, readable by anyone. Verified with a probe before
-- writing this: anon -> true, signed-in non-moderator -> false.
--
-- The distinction that was actually wanted is not "is there a user" but "is
-- this a PostgREST request at all". PostgREST always sets request.jwt.claims
-- with a role; a trigger, a migration or a psql session has no such setting,
-- and service_role names itself. So test the role claim rather than the uid.
--
-- Enforcement is untouched. Every call site -- 20 policies and the
-- restrict_banned_profile_edit trigger -- calls the no-argument form, which
-- defaults target to auth.uid() and so takes the second branch. Confirmed by
-- reading pg_policies rather than assuming; not one passes another user's id.
--
-- The outer coalesce matters: for anon, `target = auth.uid()` is NULL rather
-- than false, and without it the function would return NULL instead of false.

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
  and coalesce(
    (
      -- No PostgREST role, or an internal one: a trigger, a migration or
      -- service_role. Answer truthfully.
      coalesce(
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
        ''
      ) not in ('anon', 'authenticated')
      -- Asking about yourself is fine, and is what every policy does.
      or target = auth.uid()
      -- Moderators legitimately need to see who is restricted.
      or is_moderator()
    ),
    false
  );
$function$;

comment on function public.is_banned(uuid) is
  'True when the user is under a pending or active ban, but only discloses that
   to the user themselves, to a moderator, or to an internal (non-PostgREST)
   caller. Anonymous and other signed-in callers always get false, so ban state
   cannot be enumerated. Enforcement policies call the no-argument form.';
