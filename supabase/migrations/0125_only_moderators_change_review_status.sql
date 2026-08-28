-- An author could undo a moderator's decision on their own review.
--
-- `locations` has had prevent_owner_status_change since 0010, so an owner
-- cannot un-remove their own listing. `reviews` never got the equivalent, and
-- the RLS policy "users edit own reviews" allows the author to update any
-- column — status included. Proved against the live database: a plain,
-- non-moderator author moved their own held review from 'hidden' back to
-- 'visible' in one statement, one row affected.
--
-- That makes every removal reversible by the person it was applied to, which
-- is the same as not having removal.
--
-- Raising rather than silently pinning the value back, per the rule in
-- CLAUDE.md: 0010's guard reverts quietly, which reports success while
-- discarding the change and leaves the caller unable to tell. A refusal a
-- client can see is the correct shape for a new guard.
--
-- Note what this deliberately does NOT do: submitReview upserts rating, title
-- and body and never names status, so an author rewriting their review is
-- untouched by this. The consequence of that — a rewrite over a removed review
-- stays removed, so the author appears unable to review the place at all — is
-- real and is handled in the app, not here.

create or replace function public.prevent_review_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- auth.uid() is null in backend and cron contexts, which must stay able to
  -- expire and purge content. Same carve-out as 0044.
  if new.status is distinct from old.status
     and auth.uid() is not null
     and not is_moderator() then
    raise exception 'Only a moderator can change the status of a review'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_prevent_status_change on public.reviews;
create trigger reviews_prevent_status_change
  before update of status on public.reviews
  for each row execute function public.prevent_review_status_change();
