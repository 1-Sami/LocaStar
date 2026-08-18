-- The half of 0114 that reading the schema would never have told you about.
--
-- `profiles` is world-readable, but only column by column: the table-wide grant
-- was replaced with per-column SELECTs so the private columns stay private. A
-- column added later therefore arrives with no grant at all, and selecting it
-- fails the *entire* request with "permission denied for table profiles" —
-- not merely omitting that column. So adding contribution_count silently broke
-- every stats load until this ran.
--
-- Found by signing in as a real user and issuing the real query. The policy
-- reads fine; the grant is a separate mechanism and it is the one that bites.

grant select (contribution_count) on public.profiles to anon, authenticated;
