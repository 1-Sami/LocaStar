-- Take a reported photo out of sight until a moderator has looked at it.
--
-- A picture is the one kind of content where waiting for review is the harm:
-- text can be read and dismissed, but anyone who opens the location has already
-- seen the photo. Holding it costs a legitimate photo a few hours of visibility
-- and costs an illegitimate one its entire audience.
--
-- The hold is applied by a trigger on the reports tables rather than by the app.
-- A reporter has no rights over somebody else's photo and should not be given
-- any — the report is the thing they are allowed to create, and the hold is a
-- consequence of it, applied by the database at the same instant.
--
-- Banned users cannot trigger it. They can still file reports, which a
-- moderator will read, but a suspended account should not be able to blank
-- other people's photographs on its way out.
--
-- KNOWN EXPOSURE, deliberately accepted for now: one report hides a photo, so
-- one determined account can hide many photos before anyone notices. That is
-- survivable at this size — reports arrive in a queue somebody reads the same
-- day, and the moderation log names the reporter — but it does not stay
-- survivable. The fix when it matters is a cap on how many photo reports one
-- account can have open at once, which needs no schema change.

alter table public.location_photos
  add column if not exists hidden_at timestamptz;
alter table public.review_photos
  add column if not exists hidden_at timestamptz;

comment on column public.location_photos.hidden_at is
  'Set while a report about this photo is awaiting a moderator. Null means visible.';
comment on column public.review_photos.hidden_at is
  'Set while a report about this photo is awaiting a moderator. Null means visible.';

create or replace function public.hold_reported_photo()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if is_banned(new.reporter_id) then
    return new;
  end if;

  if tg_table_name = 'location_reports' and new.location_photo_id is not null then
    update location_photos set hidden_at = now()
     where id = new.location_photo_id and hidden_at is null;
  elsif tg_table_name = 'review_reports' and new.review_photo_id is not null then
    update review_photos set hidden_at = now()
     where id = new.review_photo_id and hidden_at is null;
  end if;

  return new;
end;
$function$;

drop trigger if exists location_reports_hold_photo on public.location_reports;
create trigger location_reports_hold_photo
  after insert on public.location_reports
  for each row execute function public.hold_reported_photo();

drop trigger if exists review_reports_hold_photo on public.review_reports;
create trigger review_reports_hold_photo
  after insert on public.review_reports
  for each row execute function public.hold_reported_photo();

/*
 * Releasing the hold is moderators only, through here.
 *
 * Not an RLS policy. location_photos already has an UPDATE policy covering
 * "owners and moderators", so widening that route would let the person who
 * uploaded a photo clear the hold on their own photo — which is precisely the
 * person the hold exists to stop. review_photos has no UPDATE policy at all,
 * and adding one would be a second way in for the same reason.
 */
create or replace function public.release_photo_hold(
  p_location_photo_id uuid default null,
  p_review_photo_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not is_moderator() then
    raise exception 'Not allowed';
  end if;

  if p_location_photo_id is not null then
    update location_photos set hidden_at = null where id = p_location_photo_id;
  end if;
  if p_review_photo_id is not null then
    update review_photos set hidden_at = null where id = p_review_photo_id;
  end if;
end;
$function$;

-- Supabase grants EXECUTE to anon and authenticated on every new function, so
-- the revoke is not optional. See the note in CLAUDE.md — this has bitten
-- before, after a DROP and CREATE.
revoke all on function public.release_photo_hold(uuid, uuid) from public, anon;
grant execute on function public.release_photo_hold(uuid, uuid) to authenticated;
