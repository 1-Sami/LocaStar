-- Fixes review reporting, which 0104 broke outright.
--
-- hold_reported_photo() served both reports tables and branched on
-- TG_TABLE_NAME:
--
--   if tg_table_name = 'location_reports' and new.location_photo_id is not null
--   elsif tg_table_name = 'review_reports' and new.review_photo_id is not null
--
-- That reads as though the first half guards the second. It does not. PL/pgSQL
-- resolves the field against whatever record it was handed, so inserting into
-- review_reports raised
--
--   42703  record "new" has no field "location_photo_id"
--
-- before the table-name comparison could spare it. Every attempt to report a
-- review failed from the moment 0104 was applied — the photo path and the plain
-- "report this review" path alike, since neither could get past the trigger.
-- Reporting a *location* was unaffected, which is why it went unnoticed: that
-- is the branch whose column exists.
--
-- Two functions rather than one with a nested IF. A nested IF would work, on
-- the strength of PL/pgSQL compiling branch bodies lazily, but it would still
-- be a function whose correctness depends on which rows it is handed. These two
-- only ever mention their own table's column, so the failure is not available.

create or replace function public.hold_reported_location_photo()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.location_photo_id is not null and not is_banned(new.reporter_id) then
    update location_photos set hidden_at = now()
     where id = new.location_photo_id and hidden_at is null;
  end if;
  return new;
end;
$function$;

create or replace function public.hold_reported_review_photo()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.review_photo_id is not null and not is_banned(new.reporter_id) then
    update review_photos set hidden_at = now()
     where id = new.review_photo_id and hidden_at is null;
  end if;
  return new;
end;
$function$;

drop trigger if exists location_reports_hold_photo on public.location_reports;
create trigger location_reports_hold_photo
  after insert on public.location_reports
  for each row execute function public.hold_reported_location_photo();

drop trigger if exists review_reports_hold_photo on public.review_reports;
create trigger review_reports_hold_photo
  after insert on public.review_reports
  for each row execute function public.hold_reported_review_photo();

drop function if exists public.hold_reported_photo();
