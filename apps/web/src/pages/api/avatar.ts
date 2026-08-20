import { fetchProfile, updateProfile } from '@locastar/shared';
import type { APIRoute } from 'astro';

import { localePath } from '../../i18n/ui';
import { currentUser } from '../../lib/auth';

/*
 * Profile picture upload, matching what the app's settings screen does:
 * a timestamped file under avatars/, the public URL written to the profile,
 * and the previous file removed once the new one is safely in place.
 *
 * The path is built from the verified user id, never from anything the browser
 * sent. The storage INSERT policy only checks the bucket, not the path, so a
 * filename taken from the form would let one account write anywhere in the
 * bucket — including over another person's picture. Delete and update do key
 * on `owner`, which is why cleaning up the old file is safe.
 */
export const prerender = false;

/** Matches the app: JPEG, PNG or WebP, and nothing enormous. */
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 8 * 1024 * 1024;

const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** The storage path inside the media bucket, from a public URL. */
function storagePathFromPublicUrl(url: string): string | null {
  const marker = '/object/public/media/';
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { user, supabase } = await currentUser(cookies, request.headers);

  const form = await request.formData();
  const back = String(form.get('back') ?? '/account');
  const lang = back === '/sv' || back.startsWith('/sv/') ? 'sv' : 'en';

  if (!user) return redirect(localePath('/auth/sign-in', lang));

  /*
   * Removing is the other half of "editable", and the app's settings screen
   * has always had it. The file goes as well as the column: an avatar is a
   * picture of a person, and leaving it readable at its public URL after they
   * asked for it gone is not removal.
   */
  if (form.get('remove') === '1') {
    try {
      const current = await fetchProfile(supabase, user.id).catch(() => null);
      await updateProfile(supabase, user.id, { avatar_url: null });

      const currentPath = current?.avatar_url ? storagePathFromPublicUrl(current.avatar_url) : null;
      if (currentPath) {
        const { error: removeError } = await supabase.storage.from('media').remove([currentPath]);
        if (removeError) console.error('Could not delete the avatar file', removeError);
      }
    } catch (error) {
      console.error('Avatar removal failed', error);
      return redirect(`${back}?avatarError=1`);
    }
    return redirect(`${back}?avatar=removed`);
  }

  const file = form.get('avatar');
  if (!(file instanceof File) || file.size === 0) {
    return redirect(`${back}?avatarError=none`);
  }
  if (!ALLOWED.has(file.type)) {
    return redirect(`${back}?avatarError=type`);
  }
  if (file.size > MAX_BYTES) {
    return redirect(`${back}?avatarError=size`);
  }

  const path = `avatars/${user.id}-${Date.now()}.${EXTENSION[file.type]}`;

  try {
    const previous = await fetchProfile(supabase, user.id).catch(() => null);

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;

    const publicUrl = supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
    await updateProfile(supabase, user.id, { avatar_url: publicUrl });

    /*
     * Tidy the old file, but only after the new one is committed. Best effort:
     * the change has already succeeded, and an orphaned image is not worth
     * failing the request over. Same reasoning as the app.
     */
    const previousPath = previous?.avatar_url ? storagePathFromPublicUrl(previous.avatar_url) : null;
    if (previousPath && previousPath !== path) {
      const { error: removeError } = await supabase.storage.from('media').remove([previousPath]);
      if (removeError) console.error('Could not delete the previous avatar', removeError);
    }
  } catch (error) {
    console.error('Avatar upload failed', error);
    return redirect(`${back}?avatarError=1`);
  }

  return redirect(`${back}?avatar=1`);
};
