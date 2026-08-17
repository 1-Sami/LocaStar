-- The daily emptying of the trash.
--
-- 04:15, which is after delete-expired-activities on the hour and after
-- delete-empty-public-lists at 03:30, so the three nightly jobs do not overlap
-- and a slow one cannot push another into the morning.
--
-- Same shape as send-activity-reminders: pg_cron calls the edge function
-- through pg_net because storage objects can only be emptied through the
-- storage API, and a row deleted while its object survives would leave a
-- removed photo still fetchable by URL.
--
-- The Authorization header carries the anon key, which is public and already
-- inside the app. It only satisfies verify_jwt; the function authenticates to
-- the database with its own service role key from the environment, which is why
-- expired_removed_content() is granted to service_role alone. The service key
-- deliberately does not appear here — this command is readable by anyone who
-- can read the database.
--
-- Worst case if a stranger triggers the endpoint: the trash is emptied earlier
-- in the day than intended. Nothing inside the retention window can be touched,
-- because what is due is decided in SQL and not by the caller.

select cron.schedule(
  'purge-removed-content',
  '15 4 * * *',
  $$
    select net.http_post(
      url := 'https://qjhyxbfdmkegpjetnpbo.supabase.co/functions/v1/purge-removed-content',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqaHl4YmZkbWtlZ3BqZXRucGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDYxODAsImV4cCI6MjA5OTUyMjE4MH0.pVPwVbEfh_kipmpBg60niW-eAcevowLFJ-OqkIWS60E'
      ),
      body := '{}'::jsonb
    );
  $$
);
