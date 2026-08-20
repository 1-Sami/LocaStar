import type { APIRoute } from 'astro';

import { localePath } from '../../i18n/ui';
import { sessionClient } from '../../lib/auth';

export const prerender = false;

/*
 * POST only.
 *
 * A GET sign-out can be triggered by any page that embeds the URL as an image
 * or a prefetch, which logs people out at random. A form post cannot be
 * triggered that way.
 */
export const POST: APIRoute = async ({ cookies, request, redirect }) => {
  // Signing out of the Swedish site should not land on the English home page.
  const from = new URL(request.url).searchParams.get('back') ?? request.headers.get('referer') ?? '/';
  const path = (() => { try { return new URL(from, 'http://x').pathname; } catch { return '/'; } })();
  const lang = path === '/sv' || path.startsWith('/sv/') ? 'sv' : 'en';
  const supabase = sessionClient(cookies, request.headers);
  await supabase.auth.signOut();
  return redirect(localePath('/', lang));
};
