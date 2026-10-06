-- Reconstructed 2026-10-06 from supabase_migrations.schema_migrations.
--
-- Applied to the live database on 2026-08-24 and never written to a file. The
-- SQL below is the copy Postgres kept, verbatim. This is one of two security
-- fixes that were live but undocumented for two months; see CLAUDE.md.
--
-- Verified still in force on 2026-10-06: nothing holds EXECUTE on
-- claim_pending_notification_pushes() but service_role.

-- 0118 wrote `revoke all ... from public`, which only strips what was granted
-- to the PUBLIC pseudo-role. anon and authenticated had execute on every new
-- function in this schema from an existing default-privileges rule, so they
-- kept it -- confirmed live: information_schema.routine_privileges listed
-- both after 0118 ran. claim_activity_reminders() got this right in 0094 by
-- naming the roles explicitly; do the same here.
revoke all on function public.claim_pending_notification_pushes() from public, anon, authenticated;
grant execute on function public.claim_pending_notification_pushes() to service_role;
