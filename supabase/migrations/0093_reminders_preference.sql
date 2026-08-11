-- A fourth notification preference: reminders for activities you saved.
--
-- The other three already exist and are honoured by the app: reviews, shares,
-- marketing. This one covers "an activity you favourited or saved starts
-- tomorrow", which is the feature the owner asked for.
--
-- Defaults to true, unlike marketing. The distinction is consent: nobody asked
-- for marketing, whereas a reminder is only ever sent about an activity the
-- person went out of their way to save. Turning it on by default is delivering
-- what they already asked for; turning marketing on by default would be
-- deciding on their behalf.
--
-- Two statements, because the column default only applies to rows created after
-- it. Existing profiles keep whatever jsonb they were created with, and a
-- missing key reads as null rather than true — so the sending job would skip
-- exactly the people who have been here longest. They are backfilled here.

alter table public.profiles
  alter column notification_preferences
  set default '{"reviews": true, "shares": true, "marketing": false, "reminders": true}'::jsonb;

update public.profiles
set notification_preferences = notification_preferences || '{"reminders": true}'::jsonb
where not (notification_preferences ? 'reminders');
