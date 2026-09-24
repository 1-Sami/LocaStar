-- Two changes, one file, because they touch the same function.
--
-- 1. The review floor drops from 40 characters to 20.
--
--    40 was a guess, and the live data said it was the wrong guess: of the
--    reviews in the database, only two cleared it. "Jätte mysigt lekplats" is
--    a real review by a real tester and scored nothing. The floor exists to
--    stop a one-word rating farming points, and 20 does that without
--    discouraging the short, honest note most people actually write.
--
--    A review is worth 5 rather than 8 to match: cheaper to clear, so cheaper
--    to earn. The bonuses for the first review on a place (+15) and for
--    attaching your own photo (+10) are unchanged — those are the two that
--    cost something.
--
--    ⚠ 20 is repeated in packages/shared/src/achievements.ts as
--    REVIEW_MIN_CHARACTERS, so the app can say so while the review is being
--    written. Change both or neither.
--
-- 2. The counts can now be asked for somebody else, so a badge can sit beside
--    a review author's name.
--
--    The body of it moves into achievement_counts_of(uuid), which is internal;
--    my_achievement_counts() and achievement_counts_for(uuid[]) are the two
--    ways in. One definition of the facts, so the badge you see on your own
--    profile and the badge a stranger sees on your review cannot drift.

create or replace function public.achievement_counts_of(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with me as (
  select p_user as uid
),
my_places as (
  select l.id, l.created_at
  from locations l, me
  where l.created_by = me.uid
    and l.import_batch is null
    and l.visibility = 'public'
    and l.kind = 'place'
    and l.status = 'active'
),
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
    and length(btrim(coalesce(r.body, ''))) >= 20
),
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

create or replace function public.my_achievement_counts()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select achievement_counts_of(auth.uid());
$$;

/*
 * The counts behind other people's badges.
 *
 * Capped at 40 ids because it exists to badge the review authors on one place
 * page, and an uncapped array over a SECURITY DEFINER function is an invitation
 * to walk the whole user table in one request.
 *
 * Open to anon as well as authenticated: the website shows reviews to people
 * who are not signed in, and a badge missing for exactly those readers would be
 * the odd case rather than the safe one. Everything counted here is derived
 * from content that is already public — the places, photos and reviews the
 * person put on the map — with one exception worth naming: reportsUpheld
 * counts reports the person made that a moderator agreed with. It names nobody
 * else and reveals nothing about who was reported, but it is the one number
 * here that is not visible on the map, and it is worth 5 points each.
 */
create or replace function public.achievement_counts_for(p_user_ids uuid[])
returns table (user_id uuid, counts jsonb)
language sql
stable
security definer
set search_path = public
as $$
  -- Only the roles that collect achievements at all. A partner or an admin has
  -- no shelf of their own, so a badge beside their review would be claiming
  -- something the app refuses to show them. The rule lives here rather than in
  -- each caller, so the app and the website cannot disagree about it.
  select p.id, achievement_counts_of(p.id)
  from unnest(p_user_ids[1:40]) as u
  join profiles p on p.id = u
  where p.role in ('user', 'superuser');
$$;

-- Internal: the two wrappers above are the API. anon and authenticated hold
-- EXECUTE of their own on a new function, so revoking from public is not
-- enough on its own.
revoke all on function public.achievement_counts_of(uuid) from public, anon, authenticated;
revoke all on function public.my_achievement_counts() from public, anon, authenticated;
revoke all on function public.achievement_counts_for(uuid[]) from public, anon, authenticated;
grant execute on function public.my_achievement_counts() to authenticated;
grant execute on function public.achievement_counts_for(uuid[]) to anon, authenticated;
