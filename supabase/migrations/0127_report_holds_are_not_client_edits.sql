-- 0125 broke reporting a review, for everybody except moderators.
--
-- That migration stopped an author changing their own review's status, which
-- was a real hole — a removal was reversible by the person it was applied to.
-- What it missed: reporting a review *also* changes that review's status.
-- 0112's hold_reported_review() sets it to 'hidden', and it runs as the
-- reporter, who is an ordinary person with no business changing anybody's
-- status. The guard refused, the whole INSERT failed, and the report was never
-- filed.
--
-- It went unnoticed because every report filed since has come from the owner's
-- own admin account, which passes is_moderator() and sailed through. A real
-- user reporting a review has been getting an error the whole time.
--
-- Found by a rolling-back probe written to test something else entirely, which
-- is the argument for writing them.
--
-- The fix separates the two things the guard was conflating. A client editing
-- a row is one thing; the report lifecycle moving content in and out of hold
-- is another, and only the first should ever be refused. The triggers that own
-- the hold now say so explicitly, for exactly the length of their own update.

create or replace function public.prevent_review_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Set only by the hold and release triggers, and cleared again immediately.
  -- Anything else changing status is a client doing it directly.
  if current_setting('locastar.report_lifecycle', true) = '1' then
    return new;
  end if;

  if new.status is distinct from old.status
     and auth.uid() is not null
     and not is_moderator() then
    raise exception 'Only a moderator can change the status of a review'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Unchanged from 0123 apart from the marker: still skips reports a block
-- filed, still ignores a report naming one of the review's photos.
create or replace function public.hold_reported_review()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.from_block then
    return new;
  end if;

  if new.review_photo_id is null and not is_banned(new.reporter_id) then
    perform set_config('locastar.report_lifecycle', '1', true);
    update reviews set status = 'hidden'
     where id = new.review_id and status = 'visible';
    perform set_config('locastar.report_lifecycle', '', true);
  end if;
  return new;
end;
$function$;

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
    perform set_config('locastar.report_lifecycle', '1', true);
    update reviews
       set status = 'visible'
     where id = new.review_id
       and status = 'hidden';
    perform set_config('locastar.report_lifecycle', '', true);
  end if;
  return new;
end;
$function$;
