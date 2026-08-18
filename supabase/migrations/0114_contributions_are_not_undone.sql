-- A tally of what someone has contributed, that does not fall when the thing
-- contributed goes away.
--
-- The stat tiles on Profile are live counts, and they have to stay that way:
-- Reviews and Added are tappable and open the matching list, so a number that
-- disagrees with what opens is a bug. But an activity ends and is retired, a
-- user tidies up an old review, a place is deleted — and the person's record
-- of having shown up shrinks each time. This column is the record. It only
-- ever goes up.
--
-- Deliberately not decremented, including on a moderator takedown. The number
-- says "things you contributed", not "things still standing", and a counter
-- that can fall is exactly what this exists to avoid.

alter table profiles
  add column if not exists contribution_count integer not null default 0;

comment on column profiles.contribution_count is
  'Lifetime count of reviews written and locations added. Never decremented — deleting the content does not undo having made it.';

-- Two functions, not one with a branch on tg_table_name.
--
-- PL/pgSQL resolves a field against the row it was handed, so a single
-- function reading `new.user_id` raises 42703 the moment it is fired by the
-- table that calls it `created_by`. Migration 0104 did exactly that and broke
-- every review report; 0111 split it. Same shape, same split.

create or replace function bump_contributions_from_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null then
    update profiles
       set contribution_count = contribution_count + 1
     where id = new.user_id;
  end if;
  return new;
end;
$$;

create or replace function bump_contributions_from_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Bulk-imported rows are created by a real account but are nobody's
  -- contribution — the same exclusion the Added tile already makes.
  if new.created_by is not null and new.import_batch is null then
    update profiles
       set contribution_count = contribution_count + 1
     where id = new.created_by;
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_bump_contributions on reviews;
create trigger reviews_bump_contributions
  after insert on reviews
  for each row execute function bump_contributions_from_review();

drop trigger if exists locations_bump_contributions on locations;
create trigger locations_bump_contributions
  after insert on locations
  for each row execute function bump_contributions_from_location();

-- Supabase grants EXECUTE on every new function to anon and authenticated.
-- These are trigger functions; nothing should be able to call them directly.
revoke execute on function bump_contributions_from_review() from anon, authenticated;
revoke execute on function bump_contributions_from_location() from anon, authenticated;

-- Seed from what is already there, so nobody starts at zero having contributed
-- for months. Anything already deleted is gone and cannot be counted — this is
-- the floor, and it only rises from here.
update profiles p
   set contribution_count =
         (select count(*) from reviews r where r.user_id = p.id)
       + (select count(*) from locations l
           where l.created_by = p.id and l.import_batch is null);
