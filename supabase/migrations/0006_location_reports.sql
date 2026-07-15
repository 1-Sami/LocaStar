-- Drop the pending-approval gate: user-submitted locations go live
-- immediately. Moderation now happens after the fact via user reports
-- (location_reports), which admins can use to flag/remove bad listings.

alter table locations alter column status set default 'active';

drop policy "authenticated users submit locations" on locations;
create policy "authenticated users submit locations" on locations
  for insert with check (auth.uid() = created_by and status = 'active');

create table location_reports (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations (id) on delete cascade,
  reporter_id uuid not null references profiles (id),
  reason text not null,
  details text,
  status report_status not null default 'open',
  resolved_by uuid references profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index location_reports_location_id_idx on location_reports (location_id);

alter table location_reports enable row level security;

create policy "reporters and admins view location reports" on location_reports
  for select using (reporter_id = auth.uid() or is_admin());

create policy "authenticated users file location reports" on location_reports
  for insert with check (auth.uid() = reporter_id);

create policy "admins resolve location reports" on location_reports
  for update using (is_admin()) with check (is_admin());
