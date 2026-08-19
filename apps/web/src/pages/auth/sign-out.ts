import type { APIRoute } from 'astro';

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
  const supabase = sessionClient(cookies, request.headers);
  await supabase.auth.signOut();
  return redirect('/');
};
