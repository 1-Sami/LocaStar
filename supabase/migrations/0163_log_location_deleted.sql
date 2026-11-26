-- A deleted place leaves a record.
--
-- Deleting a place is the one moderation act that left no trace: it is a hard
-- delete (every review, photo, save and list entry goes with it by cascade),
-- and nothing wrote to moderation_actions, so afterwards there was no way to
-- tell what had been deleted or by whom. Hidden reviews, deleted photos and
-- deleted lists were all logged; this closes the gap. Admin-only in both the
-- app and the website since 2026-11-26, which is when it was noticed.
--
-- The same rule as log_list_deleted: logged when somebody deletes a place
-- they did not create. Imported places have no creator, so every admin delete
-- of one is logged. A creator deleting their own private or finished event is
-- tidying their own things and is not a moderation decision.
--
-- The detail keeps what a person would need to recognise the place, or put it
-- back by hand, since the row itself is gone: name, kind, town, who made it
-- (an id, which the log screens show as a username) and how many reviews went
-- with it.
create or replace function public.log_location_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and auth.uid() is distinct from old.created_by
     and is_admin() then
    perform log_moderation_action(
      'location_deleted', 'location', old.id,
      jsonb_build_object(
        'name', old.name,
        'kind', old.kind,
        'city', old.city,
        'creator', old.created_by,
        'reviews', old.review_count,
        'status', old.status
      )
    );
  end if;
  return old;
end;
$$;

-- A trigger function, never meant to be called directly. See
-- revoke_from_public_is_not_enough: name the roles.
revoke all on function public.log_location_deleted() from public, anon, authenticated;

create trigger locations_log_delete
after delete on public.locations
for each row execute function public.log_location_deleted();
