-- Somewhere for the app to say that it fell over.
--
-- Nothing reports crashes today. Not Sentry, not anything. An app about to be
-- in strangers' hands can break for every one of them and the only signal is
-- somebody bothering to write in — which almost nobody does.
--
-- Deliberately anonymous. No user id, no device id, nothing that identifies a
-- person, because the Privacy Policy opens with "We only collect what the app
-- needs to work" and lists five categories that do not include diagnostics.
-- Knowing *which user* hit a crash would be more useful and would be a
-- different promise; that is a policy change and a store-declaration change,
-- made deliberately, not a column added quietly.
--
-- Anyone can insert, because a crash that happens before sign-in is exactly the
-- kind worth hearing about, and the anon key is public anyway. The abuse
-- surface is a table somebody could fill with junk, which is bounded by the
-- length caps below and emptied after thirty days. Nobody can read it back but
-- a moderator.

create table if not exists public.crash_reports (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  -- Which build. Without this a fixed crash is indistinguishable from a live
  -- one, and the first question about any report is always "still happening?".
  app_release  text not null check (length(app_release) <= 32),
  platform     text not null check (platform in ('ios', 'android', 'web')),
  os_version   text check (length(os_version) <= 64),
  -- The screen it happened on, when the app knows it.
  route        text check (length(route) <= 200),
  message      text not null check (length(message) <= 2000),
  stack        text check (length(stack) <= 8000),
  -- False for an error the app caught and carried on from.
  is_fatal     boolean not null default true
);

create index if not exists crash_reports_recent_idx
  on public.crash_reports (created_at desc);

alter table public.crash_reports enable row level security;

create policy "anyone can report a crash"
  on public.crash_reports for insert
  with check (true);

create policy "moderators read crash reports"
  on public.crash_reports for select
  using (is_moderator());

create policy "admins clear crash reports"
  on public.crash_reports for delete
  using (is_admin());

-- Thirty days is long enough to see whether a release is stable and short
-- enough that a junk flood cannot accumulate. Same shape as the empty-list
-- cleanup: plain SQL, no storage involved, so no edge function needed.
select cron.schedule(
  'delete-old-crash-reports',
  '45 4 * * *',
  $$ delete from public.crash_reports where created_at < now() - interval '30 days'; $$
);
