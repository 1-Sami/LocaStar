-- Hardening: pin search_path on clamp_activity_expiry to match the rest of
-- the schema's trigger/security-definer functions.

create or replace function clamp_activity_expiry()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.kind = 'activity' and not coalesce(new.is_boosted, false) then
    if new.expires_at is null or new.expires_at > new.created_at + interval '120 days' then
      new.expires_at := new.created_at + interval '120 days';
    end if;
  end if;
  return new;
end;
$$;
