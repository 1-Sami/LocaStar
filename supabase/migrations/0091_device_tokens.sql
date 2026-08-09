-- Where to send a push, so the notifications that already exist can reach a
-- phone that is not currently open.
--
-- Push is not a new notification system. Five triggers already write into
-- `notifications` — friend requests, friend accepts, list shares, location
-- shares, role grants — and the app polls that table every 30 seconds while it
-- is in the foreground. What is missing is delivery when it is not. This table
-- is only the address book; nothing here decides what gets sent.
--
-- One row per device, not per user: someone with a phone and a tablet expects
-- both to buzz. The Expo token is unique rather than the id, because Expo hands
-- the same token back to the same install — so an upsert on every launch is
-- idempotent instead of accumulating a row per cold start.

create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- ExponentPushToken[...] — opaque, and only ever meaningful to Expo.
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists device_tokens_user_id_idx on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

-- Read and delete only, and only your own.
--
-- There is deliberately no INSERT or UPDATE policy: registration goes through
-- the function below instead. Deliberately no moderator exception either,
-- unlike most tables here — a push token is a handle for putting words on
-- someone's lock screen, nobody needs to read another person's, and the sending
-- path runs as service_role in an edge function, which bypasses RLS anyway.

create policy "users read their own device tokens"
  on public.device_tokens for select
  using (auth.uid() = user_id);

create policy "users delete their own device tokens"
  on public.device_tokens for delete
  using (auth.uid() = user_id);

/*
 * Registering a token, via a definer function rather than an upsert under RLS.
 *
 * The reason is the shared phone. Sign out, hand it to someone else, and they
 * sign in — Expo returns the identical token, because it belongs to the
 * install, not the account. A plain upsert then has to UPDATE a row that
 * someone else owns, and an UPDATE policy's `using` clause is evaluated against
 * the row as it stands. `auth.uid() = user_id` is false for the new person, so
 * the write is refused and the previous owner keeps receiving their
 * notifications on a device that is no longer theirs.
 *
 * Relaxing the policy to `using (true)` would fix that and open something
 * worse: anyone holding a token string could point it at themselves.
 *
 * So the claim is made here instead. The function runs as definer, which lets
 * it overwrite a row it does not own, but user_id is *always* auth.uid() and is
 * never taken from an argument — so the only thing a caller can do is claim a
 * token for themselves, which is exactly the operation being modelled.
 */
create or replace function public.register_device_token(
  p_token text,
  p_platform text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'must be signed in to register a device token';
  end if;

  if p_platform not in ('ios', 'android') then
    raise exception 'unknown platform: %', p_platform;
  end if;

  -- A banned account should not be collecting an address to push to.
  if is_banned() then
    return;
  end if;

  insert into public.device_tokens (user_id, token, platform)
  values (auth.uid(), p_token, p_platform)
  on conflict (token) do update
    set user_id = auth.uid(),
        platform = excluded.platform,
        updated_at = now();
end;
$$;

revoke all on function public.register_device_token(text, text) from public;
grant execute on function public.register_device_token(text, text) to authenticated;

comment on table public.device_tokens is
  'Expo push tokens, one row per device. Written via register_device_token(), read by the notification edge function as service_role.';
