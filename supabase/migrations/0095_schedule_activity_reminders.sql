-- Runs the reminder send once a day.
--
-- 08:00 UTC, which is 10:00 in Stockholm through the summer and 09:00 in
-- winter. cron schedules are UTC and there is no way to pin one to a local
-- hour, so the choice is which hour to drift between — and both of those are a
-- reasonable time to be told about something happening tomorrow. The job only
-- needs to run at *some* point during the day before, because
-- claim_activity_reminders() decides by local calendar day rather than by how
-- many hours remain.
--
-- Once a day, not hourly, even though claiming is idempotent. The dedupe is
-- there to make a retry safe, not to make twenty-four runs the design.
--
-- The Authorization header carries the anon key, which is public and already
-- shipped inside the app. It is only there to satisfy verify_jwt; the function
-- authenticates to the database with its own SUPABASE_SERVICE_ROLE_KEY from the
-- environment, which is why claim_activity_reminders() could be granted to
-- service_role alone. The service key deliberately does not appear here — the
-- cron command is readable by anyone who can read the database.
--
-- Worst case if someone else triggers the endpoint: the day's reminders go out
-- at the wrong hour. They cannot go to the wrong people, and they cannot go
-- twice, because both of those are decided in SQL.

select cron.schedule(
  'send-activity-reminders',
  '0 8 * * *',
  $$
    select net.http_post(
      url := 'https://qjhyxbfdmkegpjetnpbo.supabase.co/functions/v1/send-activity-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqaHl4YmZkbWtlZ3BqZXRucGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDYxODAsImV4cCI6MjA5OTUyMjE4MH0.pVPwVbEfh_kipmpBg60niW-eAcevowLFJ-OqkIWS60E'
      ),
      body := '{}'::jsonb
    );
  $$
);
