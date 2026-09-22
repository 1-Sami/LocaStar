import {
  DAY_KEYS,
  fetchMyActiveBan,
  submitBusinessClaim,
  submitLocation,
  type Category,
} from '@locastar/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { AddFormCopy } from '../i18n/addForm';
import { lookupAddress, lookupCoordinates } from './geocode';
import {
  checkPhotos,
  dayEnd,
  dayStart,
  EMAIL,
  lookupMessage,
  MAX_EVENT_DAYS,
  readHours,
  uploadPhotos,
} from './locationForm';

/*
 * Adding a place or an event from the website.
 *
 * The same writes the app makes — submitLocation, then the photos, then the
 * ownership claim — through the same shared functions, as the signed-in person,
 * so RLS, the ban check (`not is_banned()` on the insert policy) and every
 * trigger apply exactly as they do to the app. Nothing here is trusted that the
 * database would not also check; the validation below exists to explain a
 * refusal before it happens, not to be the only guard.
 *
 * The pin is always looked up here on the server, never taken from the form.
 * The "Check location" preview asks the same question first, and the Worker's
 * cache answers the second asking — so what someone saw is what is saved, and a
 * hand-edited hidden field cannot choose a town.
 */

export type LocationMode = 'address' | 'coords';

export type AddOutcome =
  | {
      ok: true;
      id: string;
      pinnedBy: LocationMode;
      photosFailed: boolean;
      claimFailed: boolean;
      /** False for a private event or one scheduled for later: its page is not
          public yet, and the place page reads as a signed-out visitor. */
      visibleNow: boolean;
      /** The publish date as typed (YYYY-MM-DD) when it is still to come. The
          stored instant is Stockholm's midnight in UTC — the evening before. */
      scheduledFor: string | null;
    }
  | { ok: false; error: string; values: Record<string, string>; photosWereSent: boolean };

/** Every text field the form has, for sending back when something is wrong. */
const ECHOED = [
  'kind', 'name', 'category', 'otherDetail', 'locmode', 'street', 'area', 'coords',
  'summer', 'winter', 'price', 'description', 'open247', 'website', 'phone', 'email',
  'startDate', 'endDate', 'publishDate', 'visibility', 'showCreator', 'isOwner',
  ...DAY_KEYS.flatMap((d) => [`${d}Open`, `${d}Close`]),
];

export async function addFromForm(args: {
  form: FormData;
  supabase: SupabaseClient;
  userId: string;
  isModerator: boolean;
  categories: Category[];
  copy: AddFormCopy;
  lang: 'en' | 'sv';
}): Promise<AddOutcome> {
  const { form, supabase, userId, isModerator, categories, copy, lang } = args;

  const values: Record<string, string> = {};
  for (const key of ECHOED) values[key] = String(form.get(key) ?? '').trim();

  const photos = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
  const fail = (error: string): AddOutcome => ({ ok: false, error, values, photosWereSent: photos.length > 0 });

  const isEvent = values.kind === 'activity';
  const category = categories.find((c) => c.id === values.category);
  const mode: LocationMode = values.locmode === 'coords' ? 'coords' : 'address';

  // ---- what the database would refuse, said first ----------------------
  if (!values.name) return fail(copy.errName);
  if (!category) return fail(copy.errCategory);
  if (category.slug === 'other' && !values.otherDetail) return fail(copy.errOtherDetail);
  if (mode === 'address' ? !values.street || !values.area : !values.coords) return fail(copy.errLocation);
  if (!['yes', 'no'].includes(values.showCreator) || !['yes', 'no'].includes(values.isOwner)) return fail(copy.errChoose);
  if (isEvent && !['public', 'private'].includes(values.visibility)) return fail(copy.errChoose);
  if (isEvent && values.email && !EMAIL.test(values.email)) return fail(copy.errEmail);

  if (photos.length === 0 && !isModerator) return fail(copy.errPhoto);
  const photoProblem = checkPhotos(photos, copy);
  if (photoProblem) return fail(photoProblem);

  // ---- event dates, the app's rules --------------------------------------
  let startsAt: string | null = null;
  let expiresAt: string | null = null;
  let publishAt: string | null = null;
  if (isEvent) {
    startsAt = values.startDate ? dayStart(values.startDate) : null;
    expiresAt = values.endDate ? dayEnd(values.endDate) : null;
    if (!startsAt || !expiresAt) return fail(copy.errDatesRequired);
    if (values.endDate < values.startDate) return fail(copy.errEndBeforeStart);
    const days = (Date.parse(values.endDate) - Date.parse(values.startDate)) / 86_400_000;
    if (days > MAX_EVENT_DAYS) return fail(copy.errTooLong);
    if (values.publishDate) {
      if (values.publishDate > values.endDate) return fail(copy.errPublishAfterEnd);
      publishAt = dayStart(values.publishDate);
    }
  }

  // ---- the pin -------------------------------------------------------------
  const lookup = mode === 'address' ? await lookupAddress(values.street, values.area) : await lookupCoordinates(values.coords);
  if (!lookup.ok) return fail(lookupMessage(lookup, copy));
  const pin = lookup.pin;

  /*
   * The address is what the person typed, as the app stores it: their words
   * rather than the geocoder's. With coordinates there is nothing typed, so it
   * is the street and town around the pin — or nothing, for a spot in a forest.
   */
  const address =
    mode === 'address'
      ? `${values.street}, ${values.area}`
      : [pin.street, pin.area].filter(Boolean).join(', ') || null;

  // ---- the row ---------------------------------------------------------------
  let id: string;
  try {
    id = await submitLocation(supabase, {
      kind: isEvent ? 'activity' : 'place',
      name: values.name,
      description: values.description || null,
      address,
      city: pin.city,
      country: pin.country,
      lat: pin.lat,
      lng: pin.lng,
      categoryIds: [category.id],
      userId,
      phone: isEvent ? null : values.phone || null,
      website: values.website || null,
      email: isEvent ? values.email || null : null,
      hours: isEvent ? null : readHours(values),
      hoursNotApplicable: false,
      creatorVisible: values.showCreator === 'yes',
      visibility: isEvent && values.visibility === 'private' ? 'private' : 'public',
      startsAt,
      publishAt,
      expiresAt,
      otherCategoryDetail: category.slug === 'other' ? values.otherDetail : null,
      availableSummer: values.summer === '1',
      availableWinter: values.winter === '1',
      isFree: values.price === 'free' ? true : values.price === 'paid' ? false : null,
    });
  } catch (error) {
    console.error('Adding from the website failed', error);
    /*
     * A restricted account is refused by the insert policy with the same bare
     * permission error as anything else, so ask the database whether that is
     * why — the app does the same, and "try again" is untrue for a ban.
     */
    const ban = await fetchMyActiveBan(supabase, userId).catch(() => null);
    if (ban) {
      return fail(
        ban.expiresAt
          ? copy.errRestrictedUntil.replace('{date}', new Date(ban.expiresAt).toLocaleDateString(lang === 'sv' ? 'sv-SE' : 'en-GB'))
          : copy.errRestricted,
      );
    }
    return fail(copy.errSubmit);
  }

  // ---- after the row: photos and the claim ----------------------------------
  // Neither undoes the row if it fails — the place exists either way, and the
  // person is told what is missing rather than being made to start again.
  const photosFailed = !(await uploadPhotos(supabase, id, userId, photos));

  let claimFailed = false;
  if (values.isOwner === 'yes') {
    try {
      await submitBusinessClaim(supabase, id, userId, null);
    } catch (error) {
      console.error('Ownership claim failed', error);
      claimFailed = true;
    }
  }

  const scheduledFor = publishAt && Date.parse(publishAt) > Date.now() ? values.publishDate : null;
  const visibleNow = !(isEvent && values.visibility === 'private') && !scheduledFor;
  return { ok: true, id, pinnedBy: mode, photosFailed, claimFailed, visibleNow, scheduledFor };
}
