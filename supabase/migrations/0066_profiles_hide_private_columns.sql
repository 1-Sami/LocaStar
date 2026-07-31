-- `profiles` is read by the whole app to render usernames and avatars on
-- locations, reviews, lists and share sheets, so its SELECT policy is
-- `using (true)`. But the table also carries two columns that are nobody
-- else's business:
--
--   home_address           -- a free-text street address the user saves as
--                             the default centre for nearby search
--   notification_preferences
--
-- RLS is row-level, so `using (true)` exposed every column of every row. The
-- publishable anon key ships inside the web bundle, so this needed no account
-- at all. Verified against the live database as the `anon` role: 6 of 6
-- profile rows readable, including a populated home_address.
--
-- The Privacy Policy currently published in the app
-- (apps/mobile/src/app/legal/privacy.tsx, "What other people can see") says:
--
--   "Your email address, home address, saved places and favourites are never
--    shown to other users."
--
-- So this is a promise the database was not keeping.
--
-- Fix without touching the public-read policy, which the app genuinely needs:
-- drop the table-wide SELECT grant and re-grant it column by column, leaving
-- the two private columns out. Column privileges are checked per role, so the
-- owner loses direct read access too — my_private_profile() below hands the
-- owner their own values back.
--
-- UPDATE/INSERT grants are deliberately untouched: writes are already confined
-- to your own row by the "users update own profile" policy, and updateProfile()
-- in packages/shared does not use RETURNING, so no write path needs SELECT on
-- these columns. (See 0055 for the RETURNING trap this would otherwise hit.)
--
-- Safe against the client: no query anywhere does `select *` on profiles —
-- every read names its columns explicitly, and none of the embedded
-- `profiles!fk(...)` selects reference the two private columns.

revoke select on public.profiles from anon, authenticated;

grant select (
  id,
  username,
  display_name,
  avatar_url,
  bio,
  role,
  locale,
  theme_preference,
  created_at
) on public.profiles to anon, authenticated;

-- The owner's own private settings. Scoped to auth.uid() rather than taking a
-- user id, so there is no parameter to point at somebody else.
create or replace function public.my_private_profile()
returns table (home_address text, notification_preferences jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select p.home_address, p.notification_preferences
  from profiles p
  where p.id = auth.uid();
$$;

revoke execute on function public.my_private_profile() from public, anon;
grant execute on function public.my_private_profile() to authenticated;
