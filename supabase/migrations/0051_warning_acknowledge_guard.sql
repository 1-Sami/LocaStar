-- 0050's "users acknowledge own warnings" policy allows the recipient to UPDATE
-- their own row with no column restriction — so they could rewrite the reason
-- they were warned for, which defeats the point of a warning.
--
-- Same fix as the role guard (0040/0043): a BEFORE trigger pins every column
-- except acknowledged_at for non-moderators.
create or replace function restrict_warning_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or is_moderator() then
    return new;
  end if;

  new.user_id := old.user_id;
  new.issued_by := old.issued_by;
  new.reason := old.reason;
  new.target_type := old.target_type;
  new.target_id := old.target_id;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists user_warnings_restrict_update on user_warnings;
create trigger user_warnings_restrict_update
  before update on user_warnings
  for each row execute function restrict_warning_update();
