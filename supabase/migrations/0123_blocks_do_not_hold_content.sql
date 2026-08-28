-- A block must not take somebody's content down for everyone.
--
-- 0122 made blocking file a report, so that a block reaches a moderator
-- instead of being a silent dead end. That collided with two triggers already
-- in place: 0104 hides a reported photo until it is judged, and 0112 does the
-- same for a reported review. The result was that one person blocking one
-- author hid that author's review from the entire app until an admin cleared
-- it — found by the owner, who blocked a review on Test location 1 and watched
-- it vanish for everyone, then reappear for everyone but the blocker once the
-- report was dismissed.
--
-- The final state was right. Everything in between was not, and it is worse
-- than untidy: any account could have blanked any review in the app, for
-- everybody, by blocking its author. A hold is a community judgement that
-- something may break the rules. A block is one person saying they would
-- rather not see someone. The second must never do the work of the first.
--
-- So the reports carry where they came from, and the holds ignore the ones
-- that came from a block. The report itself still lands in the queue, still
-- names the content, and is still read — which is the part App Review asked
-- for.

alter table public.location_reports
  add column if not exists from_block boolean not null default false;
alter table public.review_reports
  add column if not exists from_block boolean not null default false;
alter table public.list_reports
  add column if not exists from_block boolean not null default false;

comment on column public.review_reports.from_block is
  'Filed automatically because the reporter blocked the author. Informational only: it never holds content, because a block is one person''s preference and not a community judgement.';

create or replace function public.hold_reported_review()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- from_block: see 0123. A block hides the content for the blocker, in the
  -- app, and must not reach anybody else's screen.
  if new.from_block then
    return new;
  end if;

  if new.review_photo_id is null and not is_banned(new.reporter_id) then
    update reviews set status = 'hidden'
     where id = new.review_id and status = 'visible';
  end if;
  return new;
end;
$function$;

create or replace function public.hold_reported_photo()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.from_block or is_banned(new.reporter_id) then
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
