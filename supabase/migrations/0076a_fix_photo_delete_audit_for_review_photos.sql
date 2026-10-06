-- Reconstructed 2026-10-06 from supabase_migrations.schema_migrations.
--
-- Applied to the live database on 2026-08-02 and never written to a file. The
-- SQL below is the copy Postgres kept, verbatim; nothing here is a rewrite or a
-- guess. See the note in CLAUDE.md about diffing the two lists.
--
-- ## What it fixes
--
-- A photo attached to a review has no user_id of its own — the column belongs to
-- location_photos, and a review's photos hang off the review. So when a
-- moderator removed one, the audit log recorded a removal with no uploader, and
-- the question the log exists to answer — whose photo was this — had no answer.
--
-- The uploader is found through the review instead, and only then is the row
-- written. The is_moderator() guard is unchanged: somebody deleting their own
-- photo is not a moderation action and does not belong in the log.

create or replace function public.log_photo_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_json jsonb := to_jsonb(old);
  uploader uuid := (row_json->>'user_id')::uuid;
begin
  if uploader is null and row_json ? 'review_id' then
    select r.user_id into uploader
    from reviews r
    where r.id = (row_json->>'review_id')::uuid;
  end if;

  if is_moderator() and uploader is distinct from auth.uid() then
    insert into moderation_actions (actor_id, actor_role, action, target_type, target_id, detail)
    values (
      auth.uid(),
      current_user_role(),
      'photo_deleted',
      tg_argv[0],
      old.id,
      jsonb_build_object('storage_path', old.storage_path, 'uploader_id', uploader)
    );
  end if;
  return old;
end;
$$;
