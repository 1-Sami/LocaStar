-- Sending a friend request wrote a row to `friendships` and nothing else, so
-- the recipient only found out by happening to open the Friends page. Notify
-- them the same way a share does, and notify the requester back when the
-- request is accepted.
--
-- Follows notify_on_list_share: SECURITY DEFINER (the notification belongs to
-- the other person, who can't insert it themselves) and honouring the
-- recipient's notification preferences.

create or replace function public.notify_on_friend_request()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  recipient_prefs jsonb;
  requester_name text;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  select notification_preferences into recipient_prefs from profiles where id = new.recipient_id;
  if (recipient_prefs ->> 'shares')::boolean is false then
    return new;
  end if;

  select coalesce(username, display_name, 'Someone') into requester_name
  from profiles where id = new.requester_id;

  insert into notifications (user_id, type, payload)
  values (
    new.recipient_id,
    'friend_request',
    jsonb_build_object('friendship_id', new.id, 'sender_name', requester_name)
  );

  return new;
end;
$function$;

create or replace function public.notify_on_friend_accept()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  requester_prefs jsonb;
  accepter_name text;
begin
  if new.status <> 'accepted' or old.status = 'accepted' then
    return new;
  end if;

  select notification_preferences into requester_prefs from profiles where id = new.requester_id;
  if (requester_prefs ->> 'shares')::boolean is false then
    return new;
  end if;

  select coalesce(username, display_name, 'Someone') into accepter_name
  from profiles where id = new.recipient_id;

  insert into notifications (user_id, type, payload)
  values (
    new.requester_id,
    'friend_accepted',
    jsonb_build_object('friendship_id', new.id, 'sender_name', accepter_name)
  );

  return new;
end;
$function$;

drop trigger if exists friendships_notify_request on friendships;
create trigger friendships_notify_request
  after insert on friendships
  for each row execute function notify_on_friend_request();

drop trigger if exists friendships_notify_accept on friendships;
create trigger friendships_notify_accept
  after update on friendships
  for each row execute function notify_on_friend_accept();
