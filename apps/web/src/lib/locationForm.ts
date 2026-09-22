import { addLocationPhoto, DAY_KEYS, type OpeningHours } from '@locastar/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { AddFormCopy } from '../i18n/addForm';
import type { Lookup } from './geocode';

/*
 * The parts adding a place and editing one both need.
 *
 * They were written for the add form first (addLocation.ts) and lifted here
 * when the edit form arrived, so that a rule lives once: the day boundaries an
 * event's dates are pinned to, the shape opening hours are stored in, the
 * photo ceiling, and where an uploaded file goes in the bucket.
 */

export const MAX_PHOTOS = 6;
/* The same ceiling the avatar route uses. Both forms shrink photos in the
   browser first, so a phone picture arrives well under it. */
export const MAX_BYTES = 8 * 1024 * 1024;
export const EXTENSION = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);
export const MAX_EVENT_DAYS = 120;
export const EMAIL = /\S+@\S+\.\S+/;

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

export const dayStart = (date: string) => stockholmInstant(date, 0, 0, 0, 0);
export const dayEnd = (date: string) => stockholmInstant(date, 23, 59, 59, 999);

/** A stored instant back as the date an <input type="date"> wants, in Stockholm. */
export function dateInput(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/*
 * Opening hours in the column's own shape. Open 24/7 is seven full days rather
 * than a flag, as in the app; a day with no times is left out, which the app
 * reads as "not stated".
 */
export function readHours(values: Record<string, string>): OpeningHours | null {
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

/** Stored hours back into the form's per-day fields. */
export function hoursToFields(hours: OpeningHours | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!hours) return out;
  const everyDayAllDay = DAY_KEYS.every(
    (day) => hours[day]?.open === '00:00' && (hours[day]?.close === '24:00' || hours[day]?.close === '00:00')
  );
  if (everyDayAllDay) {
    out.open247 = '1';
    return out;
  }
  for (const day of DAY_KEYS) {
    if (hours[day]?.open) out[`${day}Open`] = hours[day]!.open;
    if (hours[day]?.close) out[`${day}Close`] = hours[day]!.close;
  }
  return out;
}

export function lookupMessage(lookup: Extract<Lookup, { ok: false }>, copy: AddFormCopy): string {
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
  // somewhere it expects. Built from the row's id, never from the form.
  return `locations/${locationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
}

/** A file the form sent, checked against what the bucket and the policy accept. */
export function checkPhotos(photos: File[], copy: AddFormCopy): string | null {
  if (photos.length > MAX_PHOTOS) return copy.errTooManyPhotos;
  for (const photo of photos) {
    if (!EXTENSION.has(photo.type)) return copy.errPhotoType;
    if (photo.size > MAX_BYTES) return copy.errPhotoSize;
  }
  return null;
}

/**
 * Upload what was attached, stopping at the first failure.
 *
 * True means every one of them landed. A failure never undoes the place it
 * belongs to — the row exists either way, and the person is told what is
 * missing rather than being made to start again.
 */
export async function uploadPhotos(
  supabase: SupabaseClient,
  locationId: string,
  userId: string,
  photos: File[]
): Promise<boolean> {
  for (const photo of photos) {
    try {
      const path = photoPath(locationId, EXTENSION.get(photo.type)!);
      const { error } = await supabase.storage
        .from('media')
        .upload(path, photo, { contentType: photo.type, upsert: false });
      if (error) throw error;
      await addLocationPhoto(supabase, locationId, userId, path);
    } catch (error) {
      console.error('Photo upload failed', error);
      return false;
    }
  }
  return true;
}
