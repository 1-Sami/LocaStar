-- Who changed what on a place, and what it said before.
--
-- Nothing recorded content edits until now. The audit log covered status
-- changes, photo removals, bans and role grants, so a place quietly renamed, a
-- fee deleted or an address moved left no trace at all — and no previous value
-- to put back. That was survivable while only a place's own creator could edit
-- it. It stops being survivable with the partner account (kommuner, companies)
-- that may correct any place on the map: one careless afternoon could overwrite
-- hundreds of rows with nobody able to say what they used to hold.
--
-- Only edits by somebody who did not add the place are logged, the same rule
-- log_photo_deleted (0076) and log_list_deleted (0069) already follow: a person
-- fixing their own listing is not a moderation event. Every imported row
-- carries the import account as its creator, so a partner editing one is a
-- stranger's edit and is logged.
--
-- Both values are kept, not just the field name, so the log is also the undo.

create or replace function public.log_location_edited()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  /*
   * Every column a person can change from the app or the website.
   *
   * Left out on purpose: avg_rating, review_count and search_text, which the
   * database maintains; geom, whose hex would be unreadable — lat and lng are
   * generated from it and say the same thing in numbers; and status, which
   * log_location_status_change (0048) already records on its own.
   */
  watched constant text[] := array[
    'name', 'description', 'address', 'city', 'country', 'lat', 'lng',
    'phone', 'email', 'website', 'hours', 'hours_not_applicable',
    'other_category_detail', 'available_summer', 'available_winter', 'is_free',
    'visibility', 'kind', 'starts_at', 'expires_at', 'publish_at',
    'creator_visible', 'is_verified', 'is_boosted', 'claimed_by'
  ];
  before_row jsonb := to_jsonb(old);
  after_row jsonb := to_jsonb(new);
  changes jsonb := '{}'::jsonb;
  col text;
begin
  /*
   * The rating refresh and the account-delete sweep are the database editing
   * itself, and an import, a cron job or a migration has no auth.uid() at all.
   * Without this an import would write one audit row per place.
   */
  if coalesce(current_setting('locastar.rating_refresh', true), 'off') = 'on'
     or coalesce(current_setting('locastar.account_delete', true), 'off') = 'on'
     or auth.uid() is null
     or auth.uid() = old.created_by then
    return new;
  end if;

  foreach col in array watched loop
    if before_row -> col is distinct from after_row -> col then
      changes := changes || jsonb_build_object(
        col, jsonb_build_object('from', before_row -> col, 'to', after_row -> col)
      );
    end if;
  end loop;

  -- A write that changed none of them: a save with nothing edited, or a column
  -- the guard trigger reverted before it ever reached the row.
  if changes = '{}'::jsonb then
    return new;
  end if;

  perform log_moderation_action(
    'location_edited', 'location', new.id,
    jsonb_build_object('name', new.name, 'changes', changes)
  );
  return new;
end;
$$;

revoke all on function public.log_location_edited() from public, anon, authenticated;

drop trigger if exists locations_log_edit on locations;
create trigger locations_log_edit
  after update on locations
  for each row execute function public.log_location_edited();
