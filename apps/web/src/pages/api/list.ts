import { createList } from '@locastar/shared';
import type { APIRoute } from 'astro';

import { currentUser } from '../../lib/auth';

export const prerender = false;

/** Creating a list from the account area. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { user, supabase } = await currentUser(cookies, request.headers);
  if (!user) return redirect('/auth/sign-in');

  const form = await request.formData();
  const name = String(form.get('name') ?? '').trim();
  const description = String(form.get('description') ?? '').trim();
  const isPublic = String(form.get('isPublic') ?? '') === '1';

  if (!name) return redirect('/account?show=lists&listError=name');

  try {
    await createList(supabase, user.id, name, description || null, isPublic);
  } catch (error) {
    console.error('Failed to create list', error);
    return redirect('/account?show=lists&listError=1');
  }

  return redirect('/account?show=lists&created=1');
};
