import {
  DAY_KEYS,
  fetchMyActiveBan,
  setLocationCategories,
  updateLocation,
  type Category,
  type LocationDetail,
} from '@locastar/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { AddFormCopy, EditFormCopy } from '../i18n/addForm';
import { lookupCoordinates, parseCoordinates } from './geocode';
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
 * Editing a place or an event from the website.
 *
 * Same shape as addLocation.ts, and for the same reason: the writes go through
 * the shared functions as the signed-in person, so RLS, the ban check and the
 * guard trigger apply exactly as they do to the app. What a partner, a verified
 * owner or a creator may actually change is decided in the database (0144) —
 * this form offers the fields, the trigger has the last word, and migration
 * 0142 records what changed on somebody else's place.
 *
 * The pin is the one field that does not simply take what was typed. It moves
 * only when the coordinates box differs from where the place already is, and
 * then the town and country are read back from the new spot rather than left
 * saying the old one.
 */

export type EditOutcome =
  | { ok: true; photosFailed: boolean; movedPin: boolean }
  | { ok: false; error: string; values: Record<string, string>; photosWereSent: boolean };

/** Every text field the form has, for sending back when something is wrong. */
const ECHOED = [
  'name', 'category', 'otherDetail', 'address', 'coords', 'summer', 'winter', 'price',
  'description', 'open247', 'hoursNa', 'closed', 'closedUntil', 'website', 'phone', 'email',
  'startDate', 'endDate', 'publishDate',
  ...DAY_KEYS.flatMap((d) => [`${d}Open`, `${d}Close`]),
];

/** Five decimals is about a metre: enough to tell "unchanged" from "moved". */
const samePin = (a: { lat: number; lng: number }, lat: number | null, lng: number | null) =>
  lat !== null && lng !== null && a.lat.toFixed(5) === lat.toFixed(5) && a.lng.toFixed(5) === lng.toFixed(5);

export async function editFromForm(args: {
  form: FormData;
  supabase: SupabaseClient;
  userId: string;
  location: LocationDetail;
  categories: Category[];
  copy: AddFormCopy;
  editCopy: EditFormCopy;
  lang: 'en' | 'sv';
}): Promise<EditOutcome> {
  const { form, supabase, userId, location, categories, copy, editCopy, lang } = args;

  const values: Record<string, string> = {};
  for (const key of ECHOED) values[key] = String(form.get(key) ?? '').trim();

  const photos = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
  const fail = (error: string): EditOutcome => ({ ok: false, error, values, photosWereSent: photos.length > 0 });

  const isEvent = location.kind === 'activity';
  const category = categories.find((c) => c.id === values.category);

  if (!values.name) return fail(copy.errName);
  if (!category) return fail(copy.errCategory);
  if (category.slug === 'other' && !values.otherDetail) return fail(copy.errOtherDetail);
  if (isEvent && values.email && !EMAIL.test(values.email)) return fail(copy.errEmail);

  const photoProblem = checkPhotos(photos, copy);
  if (photoProblem) return fail(photoProblem);

  // ---- event dates, the app's rules --------------------------------------
  let startsAt: string | undefined;
  let expiresAt: string | undefined;
  let publishAt: string | undefined;
  if (isEvent) {
    if (!values.startDate || !values.endDate) return fail(copy.errDatesRequired);
    if (values.endDate < values.startDate) return fail(copy.errEndBeforeStart);
    const days = (Date.parse(values.endDate) - Date.parse(values.startDate)) / 86_400_000;
    if (days > MAX_EVENT_DAYS) return fail(copy.errTooLong);
    if (values.publishDate && values.publishDate > values.endDate) return fail(copy.errPublishAfterEnd);
    startsAt = dayStart(values.startDate) ?? undefined;
    expiresAt = dayEnd(values.endDate) ?? undefined;
    publishAt = values.publishDate ? (dayStart(values.publishDate) ?? undefined) : undefined;
    if (!startsAt || !expiresAt) return fail(copy.errDatesRequired);
  }

  // ---- the pin, only if it actually moved ----------------------------------
  let lat: number | undefined;
  let lng: number | undefined;
  let city: string | null | undefined;
  let country: string | null | undefined;
  let movedPin = false;

  if (values.coords) {
    const typed = parseCoordinates(values.coords);
    if (!typed) return fail(copy.errBadCoords);
    if (!samePin(typed, location.lat, location.lng)) {
      const lookup = await lookupCoordinates(values.coords);
      if (!lookup.ok) return fail(lookupMessage(lookup, copy));
      lat = lookup.pin.lat;
      lng = lookup.pin.lng;
      city = lookup.pin.city;
      country = lookup.pin.country;
      movedPin = true;
    }
  }

  // ---- the row ---------------------------------------------------------------
  try {
    await updateLocation(supabase, location.id, {
      name: values.name,
      description: values.description || null,
      address: values.address || null,
      ...(movedPin ? { lat, lng, city, country } : {}),
      website: values.website || null,
      // Offered for the kind it belongs to, and left alone for the other, so
      // editing an event cannot blank a phone number it never showed.
      ...(isEvent ? { email: values.email || null } : { phone: values.phone || null }),
      hours: isEvent ? null : readHours(values),
      hoursNotApplicable: isEvent ? false : values.hoursNa === '1',
      availableSummer: values.summer === '1',
      availableWinter: values.winter === '1',
      isFree: values.price === 'free' ? true : values.price === 'paid' ? false : null,
      ...(isEvent ? { startsAt, expiresAt, ...(publishAt ? { publishAt } : {}) } : {}),
      otherCategoryDetail: category.slug === 'other' ? values.otherDetail : null,
      temporarilyClosed: values.closed === '1',
      // A date only means anything while it is shut, so reopening clears it.
      closedUntil: values.closed === '1' ? (values.closedUntil || null) : null,
    });
  } catch (error) {
    console.error('Editing from the website failed', error);
    const ban = await fetchMyActiveBan(supabase, userId).catch(() => null);
    if (ban) {
      return fail(
        ban.expiresAt
          ? copy.errRestrictedUntil.replace('{date}', new Date(ban.expiresAt).toLocaleDateString(lang === 'sv' ? 'sv-SE' : 'en-GB'))
          : copy.errRestricted
      );
    }
    return fail(editCopy.errSave);
  }

  // The category is a row in another table, and only worth touching when it
  // changed: setLocationCategories deletes and re-inserts.
  if (category.slug !== location.category_slug) {
    try {
      await setLocationCategories(supabase, location.id, [category.id]);
    } catch (error) {
      console.error('Re-tagging failed', error);
      return fail(editCopy.errCategorySave);
    }
  }

  const photosFailed = photos.length > 0 && !(await uploadPhotos(supabase, location.id, userId, photos));
  return { ok: true, photosFailed, movedPin };
}
