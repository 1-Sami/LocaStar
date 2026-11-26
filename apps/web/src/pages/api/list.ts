import {
  createList,
  deleteList,
  removeLocationFromList,
  renameList,
  setListVisibility,
} from '@locastar/shared';
import type { APIRoute } from 'astro';

import { localePath } from '../../i18n/ui';
import { currentUser } from '../../lib/auth';
import { isUuid } from '../../lib/ids';
import { safePath } from '../../lib/redirects';

export const prerender = false;

/*
 * Creating a list from the account area, and managing one from its own page:
 * rename, public or private, take a place out, delete it. The same actions the
 * app has on its list screen.
 *
 * Plain form posts that redirect back, like api/save.ts. RLS decides every
 * write — only the owner may update a list or touch its items — but delete is
 * checked here as well, because moderators may delete any list under RLS, and
 * a page button meant for "my list" must not become a way to delete somebody
 * else's by posting a different id.
 */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { user, supabase } = await currentUser(cookies, request.headers);

  const form = await request.formData();
  const action = String(form.get('action') ?? 'create');
  // Same reasoning as api/save.ts: the submitting page carries the locale.
  const back = safePath(String(form.get('back') ?? '/'));
  const lang = back === '/sv' || back.startsWith('/sv/') ? 'sv' : 'en';
  const account = localePath('/account', lang);

  if (!user) return redirect(`${localePath('/auth/sign-in', lang)}?next=${encodeURIComponent(back)}`);

  if (action === 'create') {
    const name = String(form.get('name') ?? '').trim();
    const description = String(form.get('description') ?? '').trim();
    const isPublic = String(form.get('isPublic') ?? '') === '1';

    if (!name) return redirect(`${account}?show=lists&listError=name`);

    try {
      await createList(supabase, user.id, name, description || null, isPublic);
    } catch (error) {
      console.error('Failed to create list', error);
      return redirect(`${account}?show=lists&listError=1`);
    }

    return redirect(`${account}?show=lists&created=1`);
  }

  const listId = String(form.get('listId') ?? '');
  if (!isUuid(listId)) return new Response('Unknown list', { status: 400 });

  // Is this list the caller's own? Asked rather than assumed for every
  // management action, so the answer is the same "no" whatever RLS would
  // have allowed a moderator.
  const { data: owned, error: ownError } = await supabase
    .from('lists')
    .select('id')
    .eq('id', listId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (ownError) {
    console.error('Could not check list ownership', ownError);
    return redirect(`${back}?listError=1`);
  }
  if (!owned) return new Response(null, { status: 403 });

  try {
    if (action === 'rename') {
      const name = String(form.get('name') ?? '').trim();
      if (!name) return redirect(`${back}?listError=name`);
      await renameList(supabase, listId, name);
      return redirect(`${back}?listDone=renamed`);
    }

    if (action === 'visibility') {
      const isPublic = String(form.get('isPublic') ?? '') === '1';
      await setListVisibility(supabase, listId, isPublic);
      return redirect(`${back}?listDone=${isPublic ? 'public' : 'private'}`);
    }

    if (action === 'remove-item') {
      const locationId = String(form.get('locationId') ?? '');
      if (!isUuid(locationId)) return new Response('Unknown place', { status: 400 });
      await removeLocationFromList(supabase, listId, locationId);
      return redirect(`${back}?listDone=removed`);
    }

    if (action === 'delete') {
      await deleteList(supabase, listId);
      // The list's own page no longer exists, so go to where lists are kept.
      return redirect(`${account}?show=lists&deleted=1`);
    }
  } catch (error) {
    console.error('List action failed', action, error);
    return redirect(`${back}?listError=1`);
  }

  return new Response('Unknown action', { status: 400 });
};
