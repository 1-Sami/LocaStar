-- Reconstructed 2026-10-06 from supabase_migrations.schema_migrations.
--
-- Applied to the live database on 2026-09-24 and never written to a file. The
-- SQL below is the copy Postgres kept, verbatim. See CLAUDE.md.
--
-- ## What it fixes
--
-- The owner's own admin account showed a level badge beside its reviews, which
-- is wrong twice over: an admin earns nothing by moderating, and a badge on a
-- moderator's review reads as authority rather than as contribution.
--
-- Fixed in SQL rather than in the two clients, because hasAchievements() in
-- packages/shared already said user|superuser and both the app and the website
-- were asking anyway. One rule in one place beats the same rule in two.
--
-- The 40-row cap is unchanged — it bounds a per-screen fan-out, not a page.

create or replace function public.achievement_counts_for(p_user_ids uuid[])
returns table (user_id uuid, counts jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, achievement_counts_of(p.id)
  from unnest(p_user_ids[1:40]) as u
  join profiles p on p.id = u
  where p.role in ('user', 'superuser');
$$;

revoke all on function public.achievement_counts_for(uuid[]) from public, anon, authenticated;
grant execute on function public.achievement_counts_for(uuid[]) to anon, authenticated;
