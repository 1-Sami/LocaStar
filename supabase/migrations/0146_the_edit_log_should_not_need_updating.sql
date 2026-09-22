-- The edit log now watches every column except a named few.
--
-- 0142 listed the columns it watched. Three migrations later 0145 added
-- temporarily_closed and closed_until, nobody added them to that list, and
-- shutting a place — exactly the kind of thing a partner does that somebody
-- might want to ask about later — left no trace. Found by reading the log after
-- a test closure and finding it empty.
--
-- Inverted, so the next column is covered by default and only a deliberate
-- exclusion is silent. The cost of the default being wrong is a line in the log
-- nobody needed; the cost the other way round is the record not existing.

create or replace function public.log_location_edited()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  /*
   * Not worth a line in a moderation log:
   *   id            — it is the target of the row
   *   geom          — hex nobody can read; lat and lng are generated from it
   *                   and say the same thing in numbers
   *   search_text   — a tsvector the database rebuilds from the name and
   *                   description, both of which are logged
   *   avg_rating,
   *   review_count  — other people's reviews, not this person's edit
   *   status,
   *   removed_at    — log_location_status_change (0048) already records these
   */
  ignored constant text[] := array[
    'id', 'geom', 'search_text', 'avg_rating', 'review_count', 'status', 'removed_at'
  ];
  before_row jsonb := to_jsonb(old);
  after_row jsonb := to_jsonb(new);
  changes jsonb := '{}'::jsonb;
  col text;
begin
  if coalesce(current_setting('locastar.rating_refresh', true), 'off') = 'on'
     or coalesce(current_setting('locastar.account_delete', true), 'off') = 'on'
     or auth.uid() is null
     or auth.uid() = old.created_by then
    return new;
  end if;

  for col in select key from jsonb_each(after_row) loop
    if not (col = any (ignored)) and before_row -> col is distinct from after_row -> col then
      changes := changes || jsonb_build_object(
        col, jsonb_build_object('from', before_row -> col, 'to', after_row -> col)
      );
    end if;
  end loop;

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
