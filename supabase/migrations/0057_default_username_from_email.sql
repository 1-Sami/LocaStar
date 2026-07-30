-- New accounts had no username until the person set one in settings, so they
-- showed up as "Unknown"/blank wherever the app credits a user (@handle on a
-- location, share and friend lists, moderation screens).
--
-- Derive a starting username from the email's local part. `username` is UNIQUE,
-- so clashes are resolved with a numeric suffix, and the insert is retried on a
-- unique violation in case two signups race for the same handle.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  base text;
  candidate text;
  attempt int := 0;
begin
  -- Local part of the email, reduced to characters that read as a handle.
  base := lower(split_part(coalesce(new.email, ''), '@', 1));
  base := regexp_replace(base, '[^a-z0-9._-]', '', 'g');
  base := btrim(base, '._-');
  if base is null or base = '' then
    base := 'user';
  end if;
  base := left(base, 20);

  loop
    attempt := attempt + 1;
    if attempt = 1 then
      candidate := base;
    elsif attempt <= 50 then
      candidate := base || attempt::text;
    else
      -- Pathological case (many clashes or a signup race): fall back to a
      -- random suffix rather than looping forever.
      candidate := base || substr(md5(random()::text), 1, 6);
    end if;

    begin
      insert into public.profiles (id, display_name, username)
      values (new.id, new.raw_user_meta_data ->> 'display_name', candidate);
      return new;
    exception when unique_violation then
      if attempt > 60 then
        raise;
      end if;
      -- else: try the next candidate
    end;
  end loop;
end;
$function$;

-- Give the accounts that predate this a handle too, so they stop rendering as
-- "Unknown". Same derivation, uniqueness enforced by picking the lowest free
-- suffix per row.
do $backfill$
declare
  r record;
  base text;
  candidate text;
  attempt int;
begin
  for r in
    select p.id, u.email
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.username is null
  loop
    base := lower(split_part(coalesce(r.email, ''), '@', 1));
    base := regexp_replace(base, '[^a-z0-9._-]', '', 'g');
    base := btrim(base, '._-');
    if base is null or base = '' then
      base := 'user';
    end if;
    base := left(base, 20);

    attempt := 0;
    loop
      attempt := attempt + 1;
      if attempt = 1 then
        candidate := base;
      elsif attempt <= 50 then
        candidate := base || attempt::text;
      else
        candidate := base || substr(md5(random()::text), 1, 6);
      end if;

      exit when not exists (select 1 from public.profiles where username = candidate);
    end loop;

    update public.profiles set username = candidate where id = r.id;
  end loop;
end;
$backfill$;
