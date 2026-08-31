-- A moderator taking a photo out of public view left no trace.
--
-- 0076 logs photo_deleted, but only on a hard DELETE. Every moderator path in
-- the product soft-removes instead -- setPhotoRemoved stamps removed_at, and
-- the row stays so the photo can be brought back -- so the action that
-- actually hides someone's picture wrote nothing to moderation_actions, while
-- the equivalent action on a review has been logged since 0076. Found while
-- adding the same controls to the website: the panel says every action is
-- recorded, and for photos it was not.
--
-- Restores are logged too. "Who put this back" is the same question as "who
-- took it down" once anybody asks why a photo is public again.
--
-- Deliberately mirrors log_photo_deleted: same to_jsonb dodge (review_photos
-- has no user_id column, and reading old.user_id directly compiles and then
-- throws at runtime), same is_moderator() gate, and the same rule that acting
-- on your own upload is housekeeping rather than moderation.
create or replace function public.log_photo_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_json jsonb := to_jsonb(new);
  uploader uuid := (row_json->>'user_id')::uuid;
begin
  -- Only the transition matters. Any other update to the row is not this.
  if (old.removed_at is null) = (new.removed_at is null) then
    return new;
  end if;

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
      'photo_removal_changed',
      tg_argv[0],
      new.id,
      jsonb_build_object(
        'from', case when old.removed_at is null then 'visible' else 'removed' end,
        'to', case when new.removed_at is null then 'visible' else 'removed' end,
        'storage_path', new.storage_path,
        'uploader_id', uploader
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists location_photos_log_removal on public.location_photos;
create trigger location_photos_log_removal
after update on public.location_photos
for each row execute function public.log_photo_removal('location_photo');

drop trigger if exists review_photos_log_removal on public.review_photos;
create trigger review_photos_log_removal
after update on public.review_photos
for each row execute function public.log_photo_removal('review_photo');
