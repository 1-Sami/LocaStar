-- search_share_candidates() interpolated the caller's text straight into an
-- ILIKE pattern:
--
--   p.username ilike '%' || search_query || '%'
--   or u.email ilike '%' || search_query || '%'
--
-- so the caller controlled the pattern, not just the text. Searching for '%'
-- (or '_', or an empty string) matched every row and returned the first 10
-- profiles. Verified against the live database: with 6 profiles, a search for
-- '%' returned all 5 other users. That is the whole member directory —
-- username, display name and avatar — for anyone holding any account, and the
-- anon key plus a throwaway signup is enough to hold one. 0032 restricted this
-- function to `authenticated`, which stops drive-by scraping but not a signed-in
-- scraper.
--
-- Two separate problems, fixed separately below.
--
-- 1. Wildcard injection. Escape %, _ and \ so the caller's text is matched
--    literally. Also require two non-blank characters, matching the guard the
--    share sheet already applies client-side, so a blank query can't stand in
--    for "everyone".
--
-- 2. Substring matching on email. Even escaped, `email ilike '%a%'` lets a
--    caller harvest accounts by guessing fragments, and confirms which
--    addresses are registered. The feature only needs "I know this person's
--    email, find them" — so match email on full equality. Username stays a
--    substring search: handles are public by design and are what the search
--    box is for.
--
-- Signature is unchanged, so `fetchShareCandidates`/`searchShareCandidates` in
-- packages/shared need no edit. exclude_user_id is still honoured, but the
-- caller is now excluded unconditionally too — it was caller-supplied, so
-- passing someone else's id put yourself back in your own results.

create or replace function search_share_candidates(search_query text, exclude_user_id uuid)
returns table (id uuid, username text, display_name text, avatar_url text)
language sql
security definer
set search_path = public
stable
as $$
  with q as (
    select
      btrim(search_query) as raw,
      -- Escape LIKE metacharacters. Order matters: backslash first, or the
      -- backslashes introduced by the later replaces get escaped again.
      replace(
        replace(
          replace(btrim(search_query), E'\\', E'\\\\'),
          '%', E'\\%'
        ),
        '_', E'\\_'
      ) as escaped
  )
  select p.id, p.username, p.display_name, p.avatar_url
  from profiles p
  join auth.users u on u.id = p.id
  cross join q
  where length(q.raw) >= 2
    and p.id <> coalesce(exclude_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and p.id <> auth.uid()
    and (
      p.username ilike '%' || q.escaped || '%' escape E'\\'
      or lower(u.email) = lower(q.raw)
    )
  limit 10;
$$;

revoke execute on function search_share_candidates(text, uuid) from public;
revoke execute on function search_share_candidates(text, uuid) from anon;
grant execute on function search_share_candidates(text, uuid) to authenticated;
