-- Bans / suspensions.
--
-- Flow agreed with the product owner:
--   * A superuser issuing a ban creates it as 'pending' — enforced IMMEDIATELY
--     so an abuser can't keep posting while waiting, but still reversible.
--   * An admin then validates it ('active') or reverses it ('reversed').
--   * An admin issuing a ban skips straight to 'active' — they are the validator.
--   * expires_at null = lifetime; otherwise a temporary suspension.
create type ban_status as enum ('pending', 'active', 'reversed', 'lifted');

create table if not exists user_bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  issued_by uuid references profiles(id) on delete set null,
  reason text not null,
  -- null means a lifetime ban
  expires_at timestamptz,
  status ban_status not null default 'pending',
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

create index if not exists user_bans_user_id_idx on user_bans (user_id);
create index if not exists user_bans_status_idx on user_bans (status);

-- A ban restricts while it is pending or active and hasn't timed out.
-- 'reversed' (admin rejected it) and 'lifted' (ended early) never restrict.
create or replace function is_banned(target uuid default auth.uid())
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select exists (
    select 1 from user_bans
    where user_id = target
      and status in ('pending', 'active')
      and (expires_at is null or expires_at > now())
  );
$$;

alter table user_bans enable row level security;

-- Users must be able to read their own ban so the app can explain it to them.
create policy "users view own bans" on user_bans
  for select using (user_id = auth.uid() or is_moderator());

-- Superusers issue bans, but only as 'pending' and never on a moderator.
create policy "superusers issue pending bans" on user_bans
  for insert to authenticated
  with check (
    is_moderator()
    and issued_by = auth.uid()
    and (
      is_admin()
      or (status = 'pending' and not exists (
        select 1 from profiles p
        where p.id = user_bans.user_id and p.role in ('superuser', 'admin')
      ))
    )
  );

-- Only admins validate, reverse or lift a ban.
create policy "admins review bans" on user_bans
  for update using (is_admin()) with check (is_admin());
