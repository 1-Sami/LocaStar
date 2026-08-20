import { addLocationToList, createList, setSaved } from '@locastar/shared';
import type { APIRoute } from 'astro';

import { currentUser } from '../../lib/auth';

export const prerender = false;

/*
 * Saving, bookmarking, and putting a place in a list.
 *
 * POST only, and it redirects back to where the person was rather than
 * returning JSON — no JavaScript needed, so this works before Leaflet or
 * anything else has loaded, and it degrades to a plain form.
 *
 * Every write goes through the visitor's own session, so RLS decides. A signed
 * out request is refused by the database, not only by the check here.
 */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { user, supabase } = await currentUser(cookies, request.headers);

  const form = await request.formData();
  const action = String(form.get('action') ?? '');
  const locationId = String(form.get('locationId') ?? '');
  const back = String(form.get('back') ?? '/');

  if (!user) {
    // Send them to sign in, then back to the place they were looking at.
    return redirect(`/auth/sign-in?next=${encodeURIComponent(back)}`);
  }

  try {
    if (action === 'favorite' || action === 'bucket_list') {
      const on = String(form.get('on') ?? '') === '1';
      await setSaved(supabase, user.id, locationId, action, on);
    } else if (action === 'add-to-list') {
      const listId = String(form.get('listId') ?? '');
      if (listId === '__new') {
        const name = String(form.get('newListName') ?? '').trim();
        if (!name) return redirect(`${back}?saveError=name`);
        const created = await createList(supabase, user.id, name, null, false);
        await addLocationToList(supabase, created, locationId);
      } else if (listId) {
        await addLocationToList(supabase, listId, locationId);
      }
    } else {
      return new Response('Unknown action', { status: 400 });
    }
  } catch (error) {
    console.error('Save action failed', action, error);
    return redirect(`${back}?saveError=1`);
  }

  return redirect(`${back}?saved=${action}`);
};
