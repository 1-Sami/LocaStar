-- Sweeps the feedback queue and mails whatever is new.
--
-- Fifteen minutes, not the two that send-social-notification-pushes uses. A
-- friend request should feel close to real time; a feature request does not,
-- and batching means one mail about four ideas instead of four mails about
-- one idea each — which is how an inbox learns to filter a sender out.
--
-- Nothing is lost if this never runs. The `feedback` table is the record and
-- the admin screen reads it directly; this only saves somebody remembering to
-- go and look.
select cron.schedule(
  'notify-feedback',
  '*/15 * * * *',
  $cron$
    select net.http_post(
      url := 'https://qjhyxbfdmkegpjetnpbo.supabase.co/functions/v1/notify-feedback',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqaHl4YmZkbWtlZ3BqZXRucGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDYxODAsImV4cCI6MjA5OTUyMjE4MH0.pVPwVbEfh_kipmpBg60niW-eAcevowLFJ-OqkIWS60E'
      ),
      body := '{}'::jsonb
    );
  $cron$
);
