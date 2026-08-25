-- The linter flagged a mutable search_path on this trigger function. It is
-- not SECURITY DEFINER, so there was never a privilege-escalation path here --
-- but every other function in this schema already pins search_path, and doing
-- the same here costs nothing and clears the advisor noise.
create or replace function public.stamp_removal_clock()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.status::text = 'removed' and old.status::text is distinct from 'removed' then
    new.removed_at := now();
  elsif new.status::text <> 'removed' then
    new.removed_at := null;
  end if;
  return new;
end;
$function$;
