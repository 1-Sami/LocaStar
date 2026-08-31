-- What 0113 did for photos, now for reviews.
--
-- Reporting a review hides it (0112, status = 'hidden'). Putting it back was
-- left to the client: the app's Dismiss checks reviewStatus and calls
-- updateReviewStatus('visible') before resolving. Nothing else does — not
-- Warn, and not the report queue that now exists on the website, where
-- dismissing a report closed it and left the review invisible to everybody.
--
-- One is stranded right now: "Test review" on Test location 1, hidden, with
-- its report dismissed on the website minutes ago and nothing open to find it
-- by.
--
-- 0113 made this argument for photos and it holds here for the same reason,
-- only harder: the hold exists for exactly as long as the question is open, so
-- ending it belongs to the report's lifecycle rather than to every button in
-- every client that has to remember. There are two clients now. There will be
-- more surfaces than that, and each one would have to rediscover this.
--
-- Removal still wins. A review a moderator took down is 'removed', not
-- 'hidden', and lifting a hold must not drag it back out of the trash.
--
-- Only holds, and only reports about the review itself: a report naming one of
-- its photos never hid the review, so there is nothing of the review's to
-- release.

create or replace function public.release_review_hold_when_report_closes()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if old.status::text = 'open'
     and new.status::text <> 'open'
     and new.review_photo_id is null then
    update reviews
       set status = 'visible'
     where id = new.review_id
       and status = 'hidden';
  end if;
  return new;
end;
$function$;

drop trigger if exists review_reports_release_review_hold on public.review_reports;
create trigger review_reports_release_review_hold
  after update of status on public.review_reports
  for each row execute function public.release_review_hold_when_report_closes();

-- Free the ones already stranded: held, and with nothing still open about them.
-- 'removed' is untouched by the status filter, so the trash is left alone.
update public.reviews r
   set status = 'visible'
 where r.status = 'hidden'
   and not exists (
     select 1 from review_reports rr
      where rr.review_id = r.id
        and rr.review_photo_id is null
        and rr.status = 'open'
   );
