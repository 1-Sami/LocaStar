-- Reconstructed 2026-10-06 from supabase_migrations.schema_migrations.
--
-- Applied to the live database on 2026-08-26 and never written to a file. The
-- SQL below is the copy Postgres kept, verbatim. This is the second of two
-- security fixes that were live but undocumented for two months; see CLAUDE.md.
--
-- Verified still in force on 2026-10-06: nothing holds EXECUTE on
-- claim_unnotified_feedback() but service_role.
--
-- ⚠ One line here has since been superseded. This migration revoked
-- submit_feedback from `anon` and granted it to `authenticated` only. Migration
-- 0155 deliberately gave it back to `anon` for the closed test, so the live
-- grant is anon + authenticated and that is correct. 0155 is the one to read,
-- and the flag it added is the thing to turn off at launch.

-- Supabase's default privileges grant EXECUTE on every new public function
-- directly to anon and authenticated. "revoke from public" does not remove a
-- grant made to a named role, so all three functions were reachable over
-- /rest/v1/rpc — including claim_unnotified_feedback(), which is SECURITY
-- DEFINER and returns the message text, bypassing the admins-only policy.
revoke all on function public.submit_feedback(text, text, text, text) from public, anon;
grant execute on function public.submit_feedback(text, text, text, text) to authenticated;

revoke all on function public.claim_unnotified_feedback() from public, anon, authenticated;
grant execute on function public.claim_unnotified_feedback() to service_role;

revoke all on function public.release_feedback_notifications(uuid[]) from public, anon, authenticated;
grant execute on function public.release_feedback_notifications(uuid[]) to service_role;
