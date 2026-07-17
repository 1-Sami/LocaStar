-- Let a signed-in user permanently delete their own account. Deleting the
-- auth.users row cascades through profiles and every FK that references it
-- (saves, reviews, lists, location_shares, notifications, etc.), all of
-- which are already `on delete cascade`.

create or replace function delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function delete_own_account() to authenticated;
