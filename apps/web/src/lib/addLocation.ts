import {
  addLocationPhoto,
  DAY_KEYS,
  fetchMyActiveBan,
  submitBusinessClaim,
  submitLocation,
  type Category,
  type OpeningHours,
} from '@locastar/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { AddFormCopy } from '../i18n/addForm';
import { lookupAddress, lookupCoordinates, type Lookup } from './geocode';

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

const MAX_PHOTOS = 6;
/* The same ceiling the avatar route uses. The page's script shrinks photos in
   the browser first, so a phone picture arrives well under it. */
const MAX_BYTES = 8 * 1024 * 1024;
const EXTENSION = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);
const MAX_EVENT_DAYS = 120;
const EMAIL = /\S+@\S+\.\S+/;

/** Every text field the form has, for sending back when something is wrong. */
const ECHOED = [
  'kind', 'name', 'category', 'otherDetail', 'locmode', 'street', 'area', 'coords',
  'summer', 'winter', 'price', 'description', 'open247', 'website', 'phone', 'email',
  'startDate', 'endDate', 'publishDate', 'visibility', 'showCreator', 'isOwner',
  ...DAY_KEYS.flatMap((d) => [`${d}Open`, `${d}Close`]),
];

/*
 * The first and last instant of a date, in Stockholm.
 *
 * The app pins an event's days to the phone's own midnight; a Worker has no
 * clock of the reader's to ask, and runs in UTC, where midnight is two hours
 * late in a Swedish summer — the exact slip that once made a festival vanish at
 * 19:12 on its last day (see apps/mobile/src/lib/activity-dates.ts). Every
 * event on LocaStar is Swedish, so the day's edges are Stockholm's.
 */
function stockholmOffsetMinutes(at: Date): number {
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Stockholm', timeZoneName: 'shortOffset' })
      .formatToParts(at)
      .find((part) => part.type === 'timeZoneName')?.value;
    const match = name?.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
    if (match) return Number(match[1]) * 60 + Math.sign(Number(match[1])) * Number(match[2] ?? 0);
  } catch {
    // fall through
  }
  return 60;
}

function stockholmInstant(date: string, hours: number, minutes: number, seconds: number, ms: number): string | null {
  const parts = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return null;
  const guess = new Date(Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), hours, minutes, seconds, ms));
  return new Date(guess.getTime() - stockholmOffsetMinutes(guess) * 60_000).toISOString();
}

const dayStart = (date: string) => stockholmInstant(date, 0, 0, 0, 0);
const dayEnd = (date: string) => stockholmInstant(date, 23, 59, 59, 999);

/*
 * Opening hours in the column's own shape. Open 24/7 is seven full days rather
 * than a flag, as in the app; a day with no times is left out, which the app
 * reads as "not stated".
 */
function readHours(values: Record<string, string>): OpeningHours | null {
  if (values.open247 === '1') {
    return Object.fromEntries(DAY_KEYS.map((day) => [day, { open: '00:00', close: '24:00' }])) as OpeningHours;
  }
  const hours: OpeningHours = {};
  for (const day of DAY_KEYS) {
    const open = values[`${day}Open`];
    const close = values[`${day}Close`];
    if (/^\d{2}:\d{2}$/.test(open) && /^\d{2}:\d{2}$/.test(close)) hours[day] = { open, close };
  }
  return Object.keys(hours).length > 0 ? hours : null;
}

function lookupMessage(lookup: Extract<Lookup, { ok: false }>, copy: AddFormCopy): string {
  switch (lookup.error) {
    case 'not-found':
      return copy.errNotFound;
    case 'imprecise':
      return copy.errImprecise;
    case 'bad-coords':
      return copy.errBadCoords;
    case 'swapped':
      return copy.errSwapped.replace('{suggestion}', lookup.suggestion ?? '');
    case 'outside':
      return copy.errOutside;
    default:
      return copy.errLookupFailed;
  }
}

function photoPath(locationId: string, extension: string): string {
  // The app's shape (apps/mobile/src/lib/media-path.ts): the purge job deletes
  // storage objects by the paths the database records, so all of them must be
  // somewhere it expects. Built from the new row's id, never from the form.
  return `locations/${locationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
}

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
  if (photos.length > MAX_PHOTOS) return fail(copy.errTooManyPhotos);
  for (const photo of photos) {
    if (!EXTENSION.has(photo.type)) return fail(copy.errPhotoType);
    if (photo.size > MAX_BYTES) return fail(copy.errPhotoSize);
  }

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
  let photosFailed = false;
  for (const photo of photos) {
    try {
      const path = photoPath(id, EXTENSION.get(photo.type)!);
      const { error } = await supabase.storage.from('media').upload(path, photo, { contentType: photo.type, upsert: false });
      if (error) throw error;
      await addLocationPhoto(supabase, id, userId, path);
    } catch (error) {
      console.error('Photo upload failed', error);
      photosFailed = true;
      break;
    }
  }

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
