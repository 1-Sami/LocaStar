-- Runs the tester nudges every half hour and lets SQL decide whose slot it is.
--
-- Every thirty minutes looks wasteful for two notifications a day, and it is
-- the point. pg_cron runs in UTC, the owner asked for 11:30 and 17:00 in
-- Stockholm, and those are two different UTC times depending on whether the
-- clocks have gone back — 09:30/15:00 through late October, 10:30/16:00 after.
-- A fixed UTC crontab would quietly deliver an hour early for the second half
-- of the campaign and nobody would notice until a tester mentioned it.
--
-- So the schedule is dumb and claim_tester_nudges() is smart: it asks whether
-- Europe/Stockholm local time is inside that person's window right now.
-- Postgres knows the daylight-saving rules; a crontab does not. Forty-eight
-- cheap calls a day buys never having to think about it again.
--
-- Sending is idempotent on (user_id, day), so a run that overlaps a window
-- already served returns nothing and costs one query.
--
-- **To stop the campaign early:**
--   select cron.unschedule('tester-nudges');
-- **To see what has gone out:**
--   select * from tester_nudge_sends order by sent_at desc;

select cron.schedule(
  'tester-nudges',
  '0,30 * * * *',
  $cron$
    select net.http_post(
      url := 'https://qjhyxbfdmkegpjetnpbo.supabase.co/functions/v1/send-tester-nudges',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqaHl4YmZkbWtlZ3BqZXRucGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDYxODAsImV4cCI6MjA5OTUyMjE4MH0.pVPwVbEfh_kipmpBg60niW-eAcevowLFJ-OqkIWS60E'
      ),
      body := '{}'::jsonb
    );
  $cron$
);
