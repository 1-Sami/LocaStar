-- Account deletion did not work.
--
-- `delete_own_account()` deletes the auth.users row, which cascades to
-- `profiles`. But locations.created_by, location_photos.user_id and both
-- reporter columns are NO ACTION, which *refuses* the delete rather than
-- doing nothing. Verified against the live database: deleting an account
-- belonging to someone who had added a location fails with
--
--   23503: update or delete on table "profiles" violates foreign key
--          constraint "locations_created_by_fkey" on table "locations"
--
-- The client catches that and shows "Something went wrong deleting your
-- account. Try again.", so the most active contributors were the only people
-- who could never leave — and the Privacy Policy promises they can. That is a
-- GDPR erasure problem, not only a bug.
--
-- Fixed by anonymising rather than deleting, per the owner's decision:
-- personal data goes, community contributions stay and lose their author.
-- Otherwise one person leaving takes a location's entire rating history with
-- them, and everyone else's view of that place silently degrades.
--
-- Deleted with the account (unchanged, already CASCADE): profile row, avatar,
-- home address, saves, lists, friendships, blocks, notifications, likes,
-- shares, claims, bans and warnings. All of it is either personal data or a
-- relationship that only means anything with both people present.
--
-- Kept and orphaned: reviews, location photos, added locations, and report
-- records. The Privacy Policy already reserves moderation records for up to
-- two years "even after an account is gone"; this change extends the same
-- reasoning to public contributions and REQUIRES the "How long we keep it"
-- section to be updated, since it currently promises reviews are deleted.

-- reviews.user_id is NOT NULL and CASCADE today, so reviews vanish with their
-- author. Both have to change. The UNIQUE (location_id, user_id) constraint
-- keeps working: Postgres treats NULLs as distinct, so a location can hold any
-- number of anonymised reviews.
alter table reviews alter column user_id drop not null;
alter table reviews drop constraint reviews_user_id_fkey;
alter table reviews add constraint reviews_user_id_fkey
  foreign key (user_id) references profiles(id) on delete set null;

-- The four NO ACTION constraints that actively blocked deletion.
alter table locations drop constraint locations_created_by_fkey;
alter table locations add constraint locations_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;

alter table locations drop constraint locations_claimed_by_fkey;
alter table locations add constraint locations_claimed_by_fkey
  foreign key (claimed_by) references profiles(id) on delete set null;

alter table location_photos drop constraint location_photos_user_id_fkey;
alter table location_photos add constraint location_photos_user_id_fkey
  foreign key (user_id) references profiles(id) on delete set null;

-- Report records outlive the accounts involved, so moderation history stays
-- readable. Both reporter columns are NOT NULL today and must give that up.
alter table location_reports alter column reporter_id drop not null;
alter table location_reports drop constraint location_reports_reporter_id_fkey;
alter table location_reports add constraint location_reports_reporter_id_fkey
  foreign key (reporter_id) references profiles(id) on delete set null;

alter table location_reports drop constraint location_reports_resolved_by_fkey;
alter table location_reports add constraint location_reports_resolved_by_fkey
  foreign key (resolved_by) references profiles(id) on delete set null;

alter table review_reports alter column reporter_id drop not null;
alter table review_reports drop constraint review_reports_reporter_id_fkey;
alter table review_reports add constraint review_reports_reporter_id_fkey
  foreign key (reporter_id) references profiles(id) on delete set null;

alter table review_reports drop constraint review_reports_resolved_by_fkey;
alter table review_reports add constraint review_reports_resolved_by_fkey
  foreign key (resolved_by) references profiles(id) on delete set null;

-- A verified business claim is a statement about a person, so a claimed
-- location must not stay "verified" once that person is gone — otherwise the
-- listing keeps an owner badge nobody stands behind.
create or replace function public.clear_verification_on_owner_delete()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update locations set is_verified = false
  where claimed_by is null and is_verified;
  return null;
end;
$$;

drop trigger if exists profiles_clear_verification on profiles;
create trigger profiles_clear_verification
after delete on profiles
for each statement execute function public.clear_verification_on_owner_delete();

-- The avatar file is personal data and does not become anonymous by losing its
-- profile row — it is a picture of someone. Location and review photos are
-- different: they show places, and they are the contributions being kept.
--
-- Deleting the storage.objects row is what makes the public URL stop serving,
-- which is the part that matters for erasure.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path to 'public', 'auth', 'storage'
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in';
  end if;

  delete from storage.objects
  where bucket_id = 'media'
    and owner = me
    and name like 'avatars/%';

  delete from auth.users where id = me;
end;
$$;
