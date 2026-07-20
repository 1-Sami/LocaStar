-- Automatically delete activities once they pass their expiry date.

create extension if not exists pg_cron;

select cron.schedule(
  'delete-expired-activities',
  '0 * * * *',
  $$ delete from locations where kind = 'activity' and expires_at is not null and expires_at < now() and not coalesce(is_boosted, false); $$
);
