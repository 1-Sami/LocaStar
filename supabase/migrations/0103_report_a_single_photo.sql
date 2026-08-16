-- Let a report name one photo rather than the whole thing it belongs to.
--
-- Reporting a picture meant finding the review that carried it and reporting
-- that review. On a place with a hundred reviews the reporter has to hunt for
-- the image they just looked at, and the moderator who receives it then has to
-- do the same hunt in reverse. The photo is the thing being complained about;
-- it should be what the report points at.
--
-- A nullable column on each existing table rather than a third reports table.
-- Every photo already belongs to a location or to a review, so it belongs in
-- one of these two queues either way — and this inherits the whole pipeline
-- that already works: the open/handled split, resolution actions, the audit
-- log, the reporter's ban checks. A separate photo_reports table would have to
-- reproduce all of it to say one extra thing.
--
-- Set null rather than cascade on delete. The usual end of a photo report is a
-- moderator removing the photo, and cascading would delete the record of that
-- decision at the moment it was made — the report would vanish from the handled
-- list along with who resolved it and why. Nulling keeps the row; only the
-- thumbnail stops resolving.

alter table public.location_reports
  add column if not exists location_photo_id uuid
    references public.location_photos(id) on delete set null;

alter table public.review_reports
  add column if not exists review_photo_id uuid
    references public.review_photos(id) on delete set null;

comment on column public.location_reports.location_photo_id is
  'Set when the report is about one photo rather than the listing as a whole.';
comment on column public.review_reports.review_photo_id is
  'Set when the report is about one photo rather than the review text.';

-- Partial indexes: the queue filters these to find photo reports, and the vast
-- majority of rows will never have one set.
create index if not exists location_reports_photo_idx
  on public.location_reports (location_photo_id)
  where location_photo_id is not null;

create index if not exists review_reports_photo_idx
  on public.review_reports (review_photo_id)
  where review_photo_id is not null;
