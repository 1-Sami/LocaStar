import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';

/*
 * A Supabase client that carries the visitor's session.
 *
 * Sessions live in cookies rather than in browser storage, because the pages
 * that need them render on the server. The anonymous client in supabase.ts is
 * still what every public page uses — this one is only for the signed-in half,
 * and RLS does the authorisation either way.
 *
 * Cookies are httpOnly and SameSite=Lax: a session token readable by JavaScript
 * is a session token an injected script can take.
 */
export function sessionClient(cookies: AstroCookies, headers: Headers): SupabaseClient {
  const url = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    throw new Error('Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY');
  }

  return createServerClient(url, key, {
    cookies: {
      /*
       * Astro has no "list every cookie", so they are parsed off the request
       * header. supabase-ssr splits a large session across several chunked
       * cookies, and it needs to see all of them to reassemble one.
       */
      getAll() {
        const raw = headers.get('cookie') ?? '';
        if (!raw) return [];
        return raw
          .split(';')
          .map((part) => part.trim())
          .filter(Boolean)
          .map((part) => {
            const eq = part.indexOf('=');
            return eq === -1
              ? { name: part, value: '' }
              : { name: part.slice(0, eq), value: decodeURIComponent(part.slice(eq + 1)) };
          });
      },
      setAll(list) {
        for (const { name, value, options } of list) {
          cookies.set(name, value, {
            ...options,
            path: options?.path ?? '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: import.meta.env.PROD,
          });
        }
      },
    },
  }) as unknown as SupabaseClient;
}

/**
 * Who is signed in, or null.
 *
 * `getUser()` rather than `getSession()`: getSession trusts whatever the cookie
 * says without checking it, which is fine in a browser and not fine on a server
 * deciding what to render. getUser verifies the token with Supabase.
 */
export async function currentUser(cookies: AstroCookies, headers: Headers) {
  const supabase = sessionClient(cookies, headers);
  const { data, error } = await supabase.auth.getUser();
  if (error) return { user: null, supabase };
  return { user: data.user ?? null, supabase };
}
