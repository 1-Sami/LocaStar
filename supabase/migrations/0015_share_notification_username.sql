-- Prefer the sender's username over display_name (which is usually unset)
-- when building the "X shared a location with you" notification payload.

create or replace function notify_on_location_share()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  recipient_prefs jsonb;
  sender_name text;
  loc_name text;
begin
  select notification_preferences into recipient_prefs from profiles where id = new.recipient_id;

  if (recipient_prefs ->> 'shares')::boolean is not false then
    select coalesce(username, display_name, 'Someone') into sender_name from profiles where id = new.sender_id;
    select name into loc_name from locations where id = new.location_id;

    insert into notifications (user_id, type, payload)
    values (
      new.recipient_id,
      'share',
      jsonb_build_object(
        'location_id', new.location_id,
        'location_name', loc_name,
        'sender_name', sender_name,
        'note', new.note
      )
    );
  end if;

  return new;
end;
$$;
