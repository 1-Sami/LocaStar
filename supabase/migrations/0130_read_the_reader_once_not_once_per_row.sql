-- Every list of places pays for 8,291 lookups of who you are.
--
-- The read policy on locations asks three questions, and the first two do not
-- depend on the row at all:
--
--   created_by = auth.uid() or is_moderator() or (it is public and live)
--
-- Postgres still evaluates them per row. auth.uid() and is_moderator() are
-- STABLE, which promises the answer will not change during the statement, but
-- STABLE only permits caching — it does not ask for it, and a zero-argument
-- function in a WHERE clause is not hoisted on its own. is_moderator() is also
-- SECURITY DEFINER with a SET clause, so it cannot be inlined into the qual
-- either: it stays a real function call, and each call runs
-- `select exists (select 1 from profiles where id = auth.uid() ...)`.
--
-- So a scan of the table runs that profile lookup once per row. Measured on
-- the live database against the 8,293 locations, counting rows through the
-- policy's own condition:
--
--   auth.uid() / is_moderator() written bare    197 ms   9,192 buffers
--   the same two wrapped in (select ...)          4.5 ms    903 buffers
--
-- Roughly one extra buffer hit per row, which is the profile lookup. Warm, and
-- as a signed-in non-moderator — the case where is_moderator() really does
-- reach profiles rather than settling on a null uid — the same count was 125 ms
-- against 3 ms.
--
-- Wrapping a call in (select ...) makes it a subquery that references nothing
-- outside itself, and the planner turns that into an InitPlan: run once,
-- before the scan, and the result compared against every row as a constant.
-- Same value, same rows, one lookup instead of thousands.
--
-- The location_shares EXISTS below stays a per-row subquery, because it is
-- genuinely per-row — it asks whether *this* location was shared with you. Its
-- auth.uid() is wrapped for the same reason as the others. It is also unreached
-- for almost every row: `visibility = 'public'` is OR-ed ahead of it and every
-- public row short-circuits there.
--
-- Checked rather than assumed, because reading a policy is not the same as
-- running it. Counted through this policy and through
-- the old condition written out by hand, they agree exactly for anon, for two
-- ordinary users, for a superuser and for an admin (8,291 rows against 8,293:
-- the two inactive rows only moderators see). The two branches today's data
-- cannot reach were checked with a probe that inserts a private location and a
-- share and then rolls itself back: its owner sees it, the person it was shared
-- with sees it, another signed-in user does not, and anon does not.
alter policy "locations are readable based on visibility" on public.locations
using (
  created_by = (select auth.uid())
  or (select public.is_moderator())
  or (
    status = 'active'
    and publish_at <= now()
    and (
      visibility = 'public'
      or exists (
        select 1
        from public.location_shares ls
        where ls.location_id = locations.id
          and ls.recipient_id = (select auth.uid())
      )
    )
  )
);
