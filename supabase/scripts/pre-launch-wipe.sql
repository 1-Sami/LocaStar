-- ============================================================================
-- PRE-LAUNCH DATA WIPE  —  DESTRUCTIVE.  NOT RUN AUTOMATICALLY.
-- ============================================================================
--
-- Clears every test location, activity, review and list so the app starts from
-- zero before real locations are imported. It deliberately does NOT touch user
-- accounts: those are removed separately, once you're finished testing.
--
-- Run it in the Supabase SQL editor, one section at a time, in order.
-- Read section 0 before running anything.
--
--   Section 0  what will be deleted            (read-only, safe)
--   Section 1  rehearsal — deletes, then rolls back and reports  (safe)
--   Section 2  the real wipe                   (IRREVERSIBLE)
--   Section 3  storage cleanup                 (separate, see notes)
--   Section 4  confirm the result              (read-only, safe)
--
-- Why deleting `locations` is enough for most of it: every content table
-- cascades from locations, reviews or lists —
--   locations -> reviews, location_photos, location_categories,
--                location_reports, location_shares, saves, list_items,
--                business_claims
--   reviews   -> review_likes, review_photos, review_reports
--   lists     -> list_items, list_likes, list_saves, list_shares
-- Notifications and the moderation audit log do NOT cascade; they're handled
-- explicitly below.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- SECTION 0 — What is about to be deleted. Read-only.
-- ---------------------------------------------------------------------------
select 'locations'          as table_name, count(*) from locations
union all select 'reviews',              count(*) from reviews
union all select 'location_photos',      count(*) from location_photos
union all select 'review_photos',        count(*) from review_photos
union all select 'lists',                count(*) from lists
union all select 'list_items',           count(*) from list_items
union all select 'location_reports',     count(*) from location_reports
union all select 'review_reports',       count(*) from review_reports
union all select 'business_claims',      count(*) from business_claims
union all select 'saves',                count(*) from saves
union all select 'notifications',        count(*) from notifications
union all select '-- KEPT: profiles',    count(*) from profiles
union all select '-- KEPT: moderation_actions', count(*) from moderation_actions
order by 1;


-- ---------------------------------------------------------------------------
-- SECTION 1 — Rehearsal. Performs the deletion, reports what happened, then
-- rolls the whole thing back. Nothing is actually removed. Safe to run.
-- ---------------------------------------------------------------------------
do $rehearsal$
declare
  n_loc int; n_rev int; n_lists int; n_photos int; n_notif int;
begin
  select count(*) into n_loc from locations;
  select count(*) into n_rev from reviews;
  select count(*) into n_lists from lists;
  select count(*) into n_photos from location_photos;

  delete from notifications
  where type in ('share', 'list_share');
  get diagnostics n_notif = row_count;

  delete from lists;
  delete from locations;

  raise exception
    'REHEARSAL — nothing was deleted. Would remove: % locations, % reviews, % lists, % location photos, % share notifications. Remaining after: locations=%, reviews=%, profiles=% (kept).',
    n_loc, n_rev, n_lists, n_photos, n_notif,
    (select count(*) from locations),
    (select count(*) from reviews),
    (select count(*) from profiles);
end;
$rehearsal$;


-- ---------------------------------------------------------------------------
-- SECTION 2 — THE REAL WIPE. IRREVERSIBLE. There is no undo.
--
-- Take a database backup first (Supabase Dashboard -> Database -> Backups).
-- Run these three statements together.
-- ---------------------------------------------------------------------------

-- Share notifications point at locations that are about to disappear; they
-- don't cascade, so they'd linger and open onto nothing.
-- delete from notifications where type in ('share', 'list_share');

-- Cascades to list_items, list_likes, list_saves, list_shares.
-- delete from lists;

-- Cascades to reviews, photos, categories, reports, shares, saves and claims.
-- delete from locations;

-- Optional. The moderation log is deliberately append-only and is evidence of
-- how test reports were handled. Only clear it if you want a genuinely blank
-- history at launch — the entries will otherwise reference deleted content.
-- delete from moderation_actions;

-- Optional. Test warnings and bans issued while trying out moderation.
-- delete from user_warnings;
-- delete from user_bans;


-- ---------------------------------------------------------------------------
-- SECTION 3 — Storage. NOT handled by the SQL above.
--
-- Deleting the rows leaves every uploaded photo sitting in the `media` bucket,
-- still readable at its public URL. Deleting from storage.objects by hand only
-- removes the metadata and orphans the underlying file, so use the storage
-- API instead:
--
--   Dashboard -> Storage -> media -> select the `locations/` and `reviews/`
--   folders -> Delete.
--
-- Keep `avatars/` — those belong to accounts you are not deleting.
--
-- This query lists what is there, so you can confirm afterwards:
-- ---------------------------------------------------------------------------
select
  split_part(name, '/', 1) as folder,
  count(*) as files
from storage.objects
where bucket_id = 'media'
group by 1
order by 1;


-- ---------------------------------------------------------------------------
-- SECTION 4 — Confirm. Everything should be 0 except the kept rows.
-- ---------------------------------------------------------------------------
select 'locations' as table_name, count(*) from locations
union all select 'reviews',           count(*) from reviews
union all select 'lists',             count(*) from lists
union all select 'saves',             count(*) from saves
union all select 'location_photos',   count(*) from location_photos
union all select 'media files left',  count(*) from storage.objects where bucket_id='media'
union all select '-- KEPT: profiles', count(*) from profiles
order by 1;
