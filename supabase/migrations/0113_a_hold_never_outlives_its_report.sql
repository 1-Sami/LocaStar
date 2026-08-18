-- A photo cannot stay hidden after the report that hid it is closed.
--
-- Reporting a photo hides it (0104). Releasing it was left to the moderator's
-- action: Dismiss puts it back, Remove photo supersedes it. But Warn, Remove
-- review and Remove location do neither — so a moderator who warns the author
-- closes the report and leaves the picture hidden with nothing left to act on.
--
-- One is stranded in this database right now: a photo on Test location 1, held
-- since 2026-08-17 18:17, whose report was resolved as "warned". Invisible to
-- everybody, no open report to find it by, and no way back — the gallery shows
-- moderators photos in the *trash*, not photos on hold.
--
-- Which action a moderator picked should not decide whether a photo comes back.
-- The hold exists for exactly as long as the question is open, so the answer
-- belongs to the report's own lifecycle, not to five separate buttons that each
-- have to remember.
--
-- Removal wins, when it happened: a photo in the trash stays out of sight on
-- its own thirty-day clock, and lifting the hold must not drag it back.

create or replace function public.release_hold_when_report_closes()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if old.status::text = 'open' and new.status::text <> 'open' then
    if tg_table_name = 'location_reports' then
      update location_photos set hidden_at = null
       where id = new.location_photo_id and removed_at is null;
    else
      update review_photos set hidden_at = null
       where id = new.review_photo_id and removed_at is null;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists location_reports_release_hold on public.location_reports;
create trigger location_reports_release_hold
  after update of status on public.location_reports
  for each row execute function public.release_hold_when_report_closes();

drop trigger if exists review_reports_release_hold on public.review_reports;
create trigger review_reports_release_hold
  after update of status on public.review_reports
  for each row execute function public.release_hold_when_report_closes();

-- Free the ones already stranded: held, not in the trash, and with nothing
-- still open about them.
update public.location_photos lp
   set hidden_at = null
 where lp.hidden_at is not null
   and lp.removed_at is null
   and not exists (
     select 1 from location_reports r
      where r.location_photo_id = lp.id and r.status = 'open'
   );

update public.review_photos rp
   set hidden_at = null
 where rp.hidden_at is not null
   and rp.removed_at is null
   and not exists (
     select 1 from review_reports r
      where r.review_photo_id = rp.id and r.status = 'open'
   );
