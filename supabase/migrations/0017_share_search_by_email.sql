-- Let users search share recipients by username OR email (profiles has no
-- email column; it lives on auth.users, so this needs a security-definer
-- function to safely expose only the fields the client needs).

create or replace function search_share_candidates(search_query text, exclude_user_id uuid)
returns table (id uuid, username text, display_name text, avatar_url text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from profiles p
  join auth.users u on u.id = p.id
  where p.id <> exclude_user_id
    and (
      p.username ilike '%' || search_query || '%'
      or u.email ilike '%' || search_query || '%'
    )
  limit 10;
$$;

grant execute on function search_share_candidates(text, uuid) to authenticated;
