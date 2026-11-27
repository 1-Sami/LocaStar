-- A monthly email reminding the owner to back up.
--
-- On the free plan Supabase's daily backups cannot be restored, so the only
-- restorable copy of the reviews, accounts and photos is the one the owner
-- takes with tools/backup.ps1. The owner chose monthly by hand for the first
-- year (2026-11-27) and asked to be reminded by email, rather than an
-- automated nightly backup that would put the database password in a second
-- place. Revisit when the hosting bills come round next year.
--
-- The mail goes to support@locastar.se through the existing Brevo sender, so
-- the owner's private address appears nowhere in the code. It carries the
-- month's numbers too (new reviews, photos, accounts; database and file sizes
-- against the free plan's limits), so it is worth opening rather than a nag.
--
-- The function is called by pg_cron with only the anon key, like
-- notify-feedback, which means anyone could call it. backup_reminder_sends is
-- the guard: claim_backup_reminder() hands out stats at most once every 20
-- days and returns nothing otherwise, so poking the endpoint cannot flood the
-- inbox.

create table public.backup_reminder_sends (
  sent_at timestamptz primary key default now()
);

-- Bookkeeping, not data: nothing in the app or the website reads it, and from
-- 2026-10-30 a new table gets no API access unless granted. Grant nothing, and
-- say so (see 0133, 0137, 0139).
alter table public.backup_reminder_sends enable row level security;
revoke all on public.backup_reminder_sends from anon, authenticated;

create or replace function public.claim_backup_reminder()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  since timestamptz := now() - interval '30 days';
begin
  if exists (select 1 from backup_reminder_sends where sent_at > now() - interval '20 days') then
    return null;
  end if;
  insert into backup_reminder_sends default values;

  return jsonb_build_object(
    'new_reviews',     (select count(*) from reviews where created_at > since),
    'new_photos',      (select count(*) from location_photos where created_at > since)
                       + (select count(*) from review_photos rp join reviews r on r.id = rp.review_id where r.created_at > since),
    'new_accounts',    (select count(*) from profiles where created_at > since),
    'new_user_places', (select count(*) from locations where created_by is not null and created_at > since),
    'reviews',         (select count(*) from reviews),
    'accounts',        (select count(*) from profiles),
    'photos',          (select count(*) from storage.objects where bucket_id = 'media'),
    'db_bytes',        pg_database_size(current_database()),
    'file_bytes',      (select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects where bucket_id = 'media')
  );
end;
$$;

-- Only the edge function (service_role) may claim. Naming the roles matters:
-- a bare "from public" leaves anon and authenticated holding EXECUTE.
revoke all on function public.claim_backup_reminder() from public, anon, authenticated;
grant execute on function public.claim_backup_reminder() to service_role;

-- The 1st of every month, 08:00 UTC: 09:00 in Stockholm in winter, 10:00 in
-- summer. An hour either way does not matter for a monthly reminder, so no
-- time-zone arithmetic (compare 0151, where it did).
--
-- To stop the reminders:  select cron.unschedule('backup-reminder');
select cron.schedule(
  'backup-reminder',
  '0 8 1 * *',
  $cron$
    select net.http_post(
      url := 'https://qjhyxbfdmkegpjetnpbo.supabase.co/functions/v1/backup-reminder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqaHl4YmZkbWtlZ3BqZXRucGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDYxODAsImV4cCI6MjA5OTUyMjE4MH0.pVPwVbEfh_kipmpBg60niW-eAcevowLFJ-OqkIWS60E'
      ),
      body := '{}'::jsonb
    );
  $cron$
);
