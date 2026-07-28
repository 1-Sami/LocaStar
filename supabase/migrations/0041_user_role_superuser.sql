-- Middle moderation tier. Named "superuser" in the UI; 'admin' stays the top
-- tier so the ~18 existing is_admin() policies don't need renaming.
--
-- Kept in its own migration on purpose: Postgres won't let a newly added enum
-- value be *used* in the same transaction that adds it, so anything referencing
-- 'superuser' has to land in a later migration.
alter type user_role add value if not exists 'superuser' before 'admin';
