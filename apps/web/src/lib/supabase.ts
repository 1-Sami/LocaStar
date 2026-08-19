import { createSupabaseClient } from '@locastar/shared';

/*
 * One client per request, for anonymous reads.
 *
 * Deliberately no session persistence and no auto-refresh: these pages render
 * on the server for visitors who are not signed in, and a client that tries to
 * keep a session would be reaching for storage that does not exist in workerd.
 * The signed-in half of the site gets its own client later.
 *
 * RLS is what decides what comes back, exactly as it does for the app — the
 * publishable key grants nothing on its own.
 */
export function anonClient() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    throw new Error(
      'Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY. Copy apps/web/.env.example to .env.'
    );
  }

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
