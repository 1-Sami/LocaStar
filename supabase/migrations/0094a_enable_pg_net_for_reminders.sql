-- Enable pg_net, which the reminder schedule calls out with.
--
-- RECONSTRUCTED. This was applied straight to the live database on
-- 2026-08-11 and the file was never committed, so for two days the repo could
-- not rebuild the database it describes: a fresh environment would reach
-- 0095_schedule_activity_reminders.sql, call net.http_post, and fail on a
-- schema that does not exist. Found by comparing the applied list against the
-- files on disk.
--
-- Numbered 0094a rather than renumbering everything after it. It sorts between
-- 0094 and 0095, which is the only ordering constraint that matters — the
-- schedule needs the extension, nothing else does.
--
-- pg_cron is not enabled here. It is switched on through the Supabase
-- dashboard, lives in pg_catalog rather than extensions, and is already in
-- place; the earlier 20260720154330_activity_auto_expiry_cron migration
-- depends on it too.

create extension if not exists pg_net with schema extensions;
