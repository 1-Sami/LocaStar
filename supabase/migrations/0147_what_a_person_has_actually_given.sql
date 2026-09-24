-- What the Achievements screen counts.
--
-- The points, the badges and the eight levels are *not* here. They live in
-- packages/shared/src/achievements.ts, because they are product copy the owner
-- will want to move — a review going from 8 points to 10 should not need a
-- migration, and the app and the website must agree on the number without a
-- round trip. This function answers only the factual half: what has this person
-- contributed that still stands?
--
-- "Still stands" is the whole anti-spam mechanism. Every count below sees only
-- surviving, visible rows, so content a moderator removes takes its points with
-- it and there is nothing to write back or reconcile. Nobody can bank points
-- for a photo that was taken down an hour later.
--
-- SECURITY DEFINER, and it answers for the caller alone. As an invoker function
-- the answer would depend on what RLS lets the caller see: a review by somebody
-- they have blocked is invisible to them, which would quietly make them "first
-- on the map" for a place they were in fact second to. One definition of first,
-- the same for everyone.

create or replace function public.my_achievement_counts()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with me as (
  select auth.uid() as uid
),
/*
 * A place counts once it is on the map and staying there: public, active, and
 * not one of the 8,275 rows the OpenStreetMap import created. The importer runs
 * under a real account, so without the import_batch test whoever ran it would
 * hold every badge on the shelf and the whole thing would mean nothing.
 */
my_places as (
  select l.id, l.created_at
  from locations l, me
  where l.created_by = me.uid
    and l.import_batch is null
    and l.visibility = 'public'
    and l.kind = 'place'
    and l.status = 'active'
),
/*
 * 'past' counts too. An event that has already happened still ran, and taking
 * its points back afterwards would punish the one kind of contribution that
 * comes with an expiry date built in.
 */
my_events as (
  select l.id, l.created_at
  from locations l, me
  where l.created_by = me.uid
    and l.import_batch is null
    and l.visibility = 'public'
    and l.kind = 'activity'
    and l.status in ('active', 'past')
),
my_photos as (
  select
    p.location_id,
    p.created_at,
    p.id = (
      select earliest.id
      from location_photos earliest
      where earliest.location_id = p.location_id
        and earliest.hidden_at is null
        and earliest.removed_at is null
      order by earliest.created_at, earliest.id
      limit 1
    ) as is_first
  from location_photos p, me
  where p.user_id = me.uid
    and p.hidden_at is null
    and p.removed_at is null
),
/*
 * Forty characters, or it scores nothing. A rating with two words attached is
 * the cheapest thing anyone can post here and the most repeatable, and the
 * ratings are what the rest of the app rests on. The threshold is repeated in
 * achievements.ts so the app can say so before the review is written.
 */
my_reviews as (
  select
    r.location_id,
    r.created_at,
    r.id = (
      select earliest.id
      from reviews earliest
      where earliest.location_id = r.location_id
        and earliest.status = 'visible'
      order by earliest.created_at, earliest.id
      limit 1
    ) as is_first,
    exists (
      select 1
      from review_photos rp
      where rp.review_id = r.id
        and rp.hidden_at is null
        and rp.removed_at is null
    ) as has_photo
  from reviews r, me
  where r.user_id = me.uid
    and r.status = 'visible'
    and length(btrim(coalesce(r.body, ''))) >= 40
),
-- Every contribution in one shape, for the badges that ask *where* you have
-- been rather than how much you have done.
contributions as (
  select id as location_id, created_at from my_places
  union all
  select id, created_at from my_events
  union all
  select location_id, created_at from my_photos
  union all
  select location_id, created_at from my_reviews
),
placed as (
  select c.location_id, c.created_at, nullif(btrim(l.city), '') as city
  from contributions c
  join locations l on l.id = c.location_id
),
by_town as (
  select city, count(*) as n from placed where city is not null group by city
),
by_category as (
  select cat.slug, count(*) as n
  from placed p
  join location_categories lc on lc.location_id = p.location_id
  join categories cat on cat.id = lc.category_id
  group by cat.slug
),
/*
 * Stockholm, not UTC. A photo taken at half past midnight on 1 October is a
 * winter contribution to the person who took it, and the whole point of this
 * badge is that they came back when it was dark and cold.
 */
seasons as (
  select
    count(*) filter (
      where extract(month from created_at at time zone 'Europe/Stockholm') between 4 and 9
    ) as summer,
    count(*) filter (
      where extract(month from created_at at time zone 'Europe/Stockholm') not between 4 and 9
    ) as winter
  from placed
)
select jsonb_build_object(
  'placesAdded', (select count(*) from my_places),
  'eventsAdded', (select count(*) from my_events),
  'firstPhotos', (select count(*) from my_photos where is_first),
  'otherPhotos', (select count(*) from my_photos where not is_first),
  'reviews', (select count(*) from my_reviews),
  'firstReviews', (select count(*) from my_reviews where is_first),
  'reviewsWithPhoto', (select count(*) from my_reviews where has_photo),
  -- Only a report a moderator actually upheld. A dismissed one is worth
  -- nothing, which is what stops mass-reporting being a way to farm points.
  'reportsUpheld',
    (select count(*) from location_reports r, me where r.reporter_id = me.uid and r.status = 'actioned')
    + (select count(*) from review_reports r, me where r.reporter_id = me.uid and r.status = 'actioned')
    + (select count(*) from list_reports r, me where r.reporter_id = me.uid and r.status = 'actioned'),
  'towns', (select count(*) from by_town),
  'bestTown', coalesce((select max(n) from by_town), 0),
  'bestCategory', coalesce((select max(n) from by_category), 0),
  'summerContributions', (select summer from seasons),
  'winterContributions', (select winter from seasons)
);
$$;

-- anon and authenticated hold EXECUTE of their own on a new function, so
-- revoking from public alone leaves it wide open. This has leaked twice.
revoke all on function public.my_achievement_counts() from public, anon, authenticated;
grant execute on function public.my_achievement_counts() to authenticated;
