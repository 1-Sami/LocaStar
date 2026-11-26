import {
  addReviewPhoto,
  deleteReview,
  deleteReviewPhoto,
  fetchMyActiveBan,
  fetchReviewPhotos,
  submitReview,
} from '@locastar/shared';
import type { APIRoute } from 'astro';

import { localePath } from '../../i18n/ui';
import { currentUser } from '../../lib/auth';
import { isUuid } from '../../lib/ids';
import { EXTENSION, MAX_BYTES, MAX_PHOTOS } from '../../lib/locationForm';
import { safePath } from '../../lib/redirects';

export const prerender = false;

/*
 * Writing, editing and deleting your own review from a place page.
 *
 * The same shape as api/save.ts: a plain form POST that redirects back, so it
 * works before any script has loaded. The outcome travels in the query string
 * and the place page turns it into a sentence.
 *
 * Every write goes through the visitor's own session. RLS is what actually
 * decides — a review can only be written as yourself, only edited or deleted
 * by its author, and a banned account is refused by the insert policy — so the
 * checks here exist to give a clear message, not to keep anybody out.
 *
 * One review per person per place: `reviews` is unique on (location_id,
 * user_id) and submitReview upserts on it, exactly as the app does. Writing a
 * second time edits the first.
 */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { user, supabase } = await currentUser(cookies, request.headers);

  const form = await request.formData();
  const action = String(form.get('action') ?? 'save');
  const locationId = String(form.get('locationId') ?? '');
  // Caller-supplied, so it is checked before it reaches redirect().
  const back = safePath(String(form.get('back') ?? '/'));
  const lang = back === '/sv' || back.startsWith('/sv/') ? 'sv' : 'en';
  const done = (query: string) => redirect(`${back}?${query}#reviews`);

  if (!user) {
    return redirect(`${localePath('/auth/sign-in', lang)}?next=${encodeURIComponent(back)}`);
  }
  if (!isUuid(locationId)) return new Response('Unknown place', { status: 400 });

  /*
   * The review is found by who is asking and where, never by an id from the
   * form. An admin's session may delete anybody's review under RLS, so an id
   * taken on trust would let the website's "delete my review" button delete
   * somebody else's. Asking for *my* review at *this* place cannot.
   */
  const { data: mine, error: lookupError } = await supabase
    .from('reviews')
    .select('id')
    .eq('location_id', locationId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (lookupError) {
    console.error('Could not look up own review', lookupError);
    return done('reviewError=1');
  }
  const myReviewId = (mine as { id: string } | null)?.id ?? null;

  if (action === 'delete') {
    if (!myReviewId) return done('review=deleted');
    try {
      /*
       * Photos first, one at a time, because deleteReviewPhoto also removes
       * the stored file. Deleting the review alone takes the photo rows with
       * it by cascade but leaves the files in the bucket with nothing
       * pointing at them.
       */
      const photos = await fetchReviewPhotos(supabase, myReviewId);
      for (const photo of photos) await deleteReviewPhoto(supabase, photo);
      await deleteReview(supabase, myReviewId);
    } catch (error) {
      console.error('Deleting a review from the website failed', error);
      return done('reviewError=1');
    }
    return done('review=deleted');
  }

  if (action !== 'save') return new Response('Unknown action', { status: 400 });

  const rating = Number(form.get('rating'));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return done('reviewError=rating');

  const title = String(form.get('title') ?? '').trim();
  const body = String(form.get('body') ?? '').trim();

  // An empty file input still arrives as one nameless, zero-byte File.
  const newPhotos = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
  const removeIds = new Set(form.getAll('removePhoto').map(String));

  for (const photo of newPhotos) {
    if (!EXTENSION.has(photo.type)) return done('reviewError=photoType');
    if (photo.size > MAX_BYTES) return done('reviewError=photoSize');
  }

  let reviewId: string;
  try {
    reviewId = await submitReview(supabase, {
      locationId,
      userId: user.id,
      rating,
      title: title || null,
      body: body || null,
    });
  } catch (error) {
    console.error('Saving a review from the website failed', error);
    // "Try again" is untrue for a ban, so ask the database whether that is why.
    const ban = await fetchMyActiveBan(supabase, user.id).catch(() => null);
    if (ban) {
      return done(ban.expiresAt ? `reviewError=restricted&until=${encodeURIComponent(ban.expiresAt)}` : 'reviewError=restricted');
    }
    return done('reviewError=1');
  }

  /*
   * The words are saved at this point, and nothing below undoes them: a photo
   * that fails is reported as missing rather than costing somebody what they
   * wrote.
   */
  try {
    const existing = await fetchReviewPhotos(supabase, reviewId);
    for (const photo of existing) {
      if (removeIds.has(photo.id)) await deleteReviewPhoto(supabase, photo);
    }
    const kept = existing.filter((photo) => !removeIds.has(photo.id)).length;
    if (kept + newPhotos.length > MAX_PHOTOS) return done('review=saved&reviewError=tooManyPhotos');

    for (const photo of newPhotos) {
      // The app's path shape (apps/mobile/src/lib/media-path.ts): the purge
      // job finds files by the paths the database records.
      const path = `reviews/${reviewId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${EXTENSION.get(photo.type)}`;
      const { error } = await supabase.storage
        .from('media')
        .upload(path, photo, { contentType: photo.type, upsert: false });
      if (error) throw error;
      await addReviewPhoto(supabase, reviewId, path);
    }
  } catch (error) {
    console.error('Review photo step failed', error);
    return done('review=saved&reviewError=photos');
  }

  return done('review=saved');
};
