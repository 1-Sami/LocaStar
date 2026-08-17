-- Three fixes to the moderation loop, all found by the owner using it.
--
-- 1. The thirty-day clock is stamped by the database, not by the app.
--
--    updateLocationStatus and updateReviewStatus set removed_at alongside
--    status, which works only for as long as every caller remembers to. Two
--    reviews are sitting in the database right now with status = 'removed' and
--    removed_at null: invisible to everyone, no countdown, and — because
--    expired_removed_content() requires a stamp — never purged either. Removed
--    forever, silently, which is the opposite of what the trash is for.
--
--    A clock that matters that much does not belong to the client.
--
-- 2. Reporting a review takes it down until a moderator looks.
--
--    Photos already work this way and reviews should match: text can be read
--    while it waits, and anyone who opens the location has already read it.
--    Reusing status = 'hidden' rather than inventing a column, because the
--    manual Hide action is gone — so 'hidden' now has exactly one meaning,
--    "held pending review", and everything downstream already understands it:
--    RLS excludes it, the rating trigger ignores it, and Restore puts it back.
--
-- 3. Reporting a review's photo does *not* hide the review, only the photo.
--    That distinction is the whole point of being able to report one picture.

create or replace function public.stamp_removal_clock()
returns trigger
language plpgsql
as $function$
begin
  if new.status::text = 'removed' and old.status::text is distinct from 'removed' then
    new.removed_at := now();
  elsif new.status::text <> 'removed' then
    -- Restored, or moved to any other state: the countdown stops.
    new.removed_at := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists reviews_stamp_removal on public.reviews;
create trigger reviews_stamp_removal
  before update of status on public.reviews
  for each row execute function public.stamp_removal_clock();

drop trigger if exists locations_stamp_removal on public.locations;
create trigger locations_stamp_removal
  before update of status on public.locations
  for each row execute function public.stamp_removal_clock();

-- The two already stranded. Their clock starts now rather than at some unknown
-- past moment, so nothing is destroyed for having been removed before this
-- existed.
update public.reviews   set removed_at = now() where status = 'removed' and removed_at is null;
update public.locations set removed_at = now() where status = 'removed' and removed_at is null;

/*
 * A reported review goes out of sight until it is judged.
 *
 * Only when the report is about the review itself. A report naming one of its
 * photos hides that photo — the trigger from 0111 — and leaves the review
 * where it is, which is the reason reporting a single picture exists at all.
 */
create or replace function public.hold_reported_review()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.review_photo_id is null and not is_banned(new.reporter_id) then
    update reviews set status = 'hidden'
     where id = new.review_id and status = 'visible';
  end if;
  return new;
end;
$function$;

drop trigger if exists review_reports_hold_review on public.review_reports;
create trigger review_reports_hold_review
  after insert on public.review_reports
  for each row execute function public.hold_reported_review();
