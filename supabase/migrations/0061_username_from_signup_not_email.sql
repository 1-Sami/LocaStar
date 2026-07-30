-- 0057 derived a new account's username from its email local part, so
-- firstname.lastname@example.com became the public handle "firstname.lastname",
-- shown on locations, reviews and share lists and substring-searchable through
-- search_share_candidates. Publishing part of someone's email address by
-- default isn't a reasonable thing to decide on their behalf.
--
-- Sign-up now asks for a handle and passes it as user metadata. Use that when
-- present; otherwise fall back to a neutral generated name, never the email.

-- Format rule, so DB-generated and user-chosen handles follow the same rules.
-- Every existing username already satisfies this.
alter table profiles drop constraint if exists profiles_username_format_check;
alter table profiles add constraint profiles_username_format_check
  check (username is null or username ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,19}$');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  requested text;
  base text;
  candidate text;
  attempt int := 0;
begin
  -- Whatever the person typed at sign-up, reduced to allowed characters.
  requested := new.raw_user_meta_data ->> 'username';
  base := regexp_replace(coalesce(requested, ''), '[^A-Za-z0-9._-]', '', 'g');
  base := btrim(base, '._-');
  base := left(base, 20);

  -- Too short or absent: a neutral handle. Deliberately not derived from the
  -- email address.
  if length(base) < 3 then
    base := 'user' || substr(md5(random()::text), 1, 6);
  end if;

  loop
    attempt := attempt + 1;
    if attempt = 1 then
      candidate := base;
    elsif attempt <= 50 then
      candidate := left(base, 17) || attempt::text;
    else
      candidate := 'user' || substr(md5(random()::text), 1, 6);
    end if;

    begin
      insert into public.profiles (id, display_name, username)
      values (new.id, new.raw_user_meta_data ->> 'display_name', candidate);
      return new;
    exception when unique_violation then
      if attempt > 60 then
        raise;
      end if;
    end;
  end loop;
end;
$function$;
