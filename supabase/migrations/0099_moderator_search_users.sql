-- Let moderators find someone by email as well as by handle.
--
-- The People screen listed every account, which is both a privacy leak in
-- miniature — the full member directory, to anyone who is made a superuser —
-- and useless at any real size. It becomes search-only, and search has to work
-- on the two things a moderator actually has: a username, which is what a
-- report shows, and an email, which is what a support message comes from.
--
-- Email cannot be searched from the client: it lives in auth.users, and
-- `profiles` deliberately does not carry it (see 0066). So this is the one way
-- to do it without copying addresses into a world-readable table.
--
-- Two deliberate restrictions, both matching search_share_candidates in 0063:
--
--   * Email is matched by EQUALITY, never by substring. A substring search over
--     addresses is an enumeration tool — type '@gmail.com' and read out the
--     directory. Equality means you can only find an address you already know.
--   * The email is never returned. A moderator who knows an address can locate
--     the account behind it; they cannot learn the address of an account they
--     are looking at. That is enough to do the job and no more.
--
-- Moderators only. is_banned's lesson from 0062 applies: a SECURITY DEFINER
-- function that takes an arbitrary argument has to check who is asking, because
-- the definer's rights bypass every policy underneath it.

create or replace function public.moderator_search_users(search_query text)
returns table (
  id uuid,
  username text,
  display_name text,
  role user_role
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with q as (
    select
      btrim(search_query) as raw,
      replace(
        replace(
          replace(btrim(search_query), E'\\', E'\\\\'),
          '%', E'\\%'
        ),
        '_', E'\\_'
      ) as escaped
  )
  select p.id, p.username, p.display_name, p.role
  from profiles p
  join auth.users u on u.id = p.id
  cross join q
  where is_moderator()
    and length(q.raw) >= 2
    and (
      p.username ilike '%' || q.escaped || '%' escape E'\\'
      or p.display_name ilike '%' || q.escaped || '%' escape E'\\'
      or lower(u.email) = lower(q.raw)
    )
  limit 25;
$function$;

-- Supabase's default privileges grant EXECUTE to anon and authenticated on
-- every new function. authenticated is correct — the function checks
-- is_moderator() itself — but anon has no business here at all.
revoke all on function public.moderator_search_users(text) from public, anon;
grant execute on function public.moderator_search_users(text) to authenticated, service_role;
