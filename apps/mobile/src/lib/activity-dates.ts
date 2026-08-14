/**
 * Turning the date pickers' answers into the instants the database stores.
 *
 * The pickers are `mode="date"` — there is no time of day to choose, anywhere
 * in the app. But a JavaScript Date always carries one, and the picker seeds it
 * with the moment the picker opened. Calling .toISOString() on that shipped the
 * accident straight into the column.
 *
 * Kultur Festivalen is the evidence: created at 17:29 UTC, it stored
 * starts_at and expires_at at 17:12 UTC — 19:12 in Stockholm — because that was
 * roughly the clock time while the form was open. An hourly pg_cron job deletes
 * activities where expires_at < now(), so the festival vanished at 19:12 on its
 * final day instead of at the end of it. The owner watched an event disappear
 * from the app while it was still going on.
 *
 * So the day has to be pinned to its own edges. The start of the chosen day for
 * a start, the last instant of it for an end.
 *
 * Deliberately the *device's* local midnight rather than Europe/Stockholm.
 * Someone adding a Swedish festival is almost always in Sweden, and "midnight"
 * to the person filling in the form means midnight where they are — pinning it
 * to a named zone would be more precise and less correct.
 */

import type { TFunction } from 'i18next';

/** 00:00:00.000 on the chosen day, local time. */
export function startOfLocalDay(date: Date): Date {
  const pinned = new Date(date);
  pinned.setHours(0, 0, 0, 0);
  return pinned;
}

/**
 * 23:59:59.999 on the chosen day, local time.
 *
 * The last representable instant of the day rather than the first of the next,
 * so an inclusive comparison cannot let it through a moment early.
 */
export function endOfLocalDay(date: Date): Date {
  const pinned = new Date(date);
  pinned.setHours(23, 59, 59, 999);
  return pinned;
}

/*
 * ---------------------------------------------------------------------------
 * Showing those dates back to people.
 *
 * This used to be written twice — once on the location screen, once on My
 * locations — and the two had already drifted: one said "Starts X · Ends Y",
 * the other "X – Y", and both had English words hardcoded in the middle of a
 * translated app.
 *
 * The words are gone. Two dates joined by an en dash reads as a range in both
 * languages the app speaks, and "Starts"/"Ends" were spending the row's
 * attention budget to say what the dash already says. What replaces them is the
 * one thing the dates do not tell you at a glance: whether this is happening
 * soon enough to matter.
 * ---------------------------------------------------------------------------
 */

/** Locale-aware, and driven by the *app's* language rather than the device's. */
function formatDay(iso: string, language: string): string {
  const date = new Date(iso);
  const options = { day: 'numeric', month: 'short', year: 'numeric' } as const;
  try {
    return date.toLocaleDateString(language, options);
  } catch {
    // A runtime without data for the tag. The device's own locale is a better
    // answer than an ISO string.
    return date.toLocaleDateString(undefined, options);
  }
}

function localDayIndex(iso: string): number {
  return Math.floor(startOfLocalDay(new Date(iso)).getTime() / 86_400_000);
}

/**
 * When an activity runs, as one line: "12 aug. 2026 – 16 aug. 2026".
 *
 * A single-day activity collapses to one date instead of printing it twice.
 * One open end still needs a word — a bare date would read as the day it
 * happens rather than the day it opens.
 */
export function formatActivityRange(
  startsAt: string | null,
  expiresAt: string | null,
  language: string,
  t: TFunction
): string | null {
  if (startsAt && expiresAt) {
    if (localDayIndex(startsAt) === localDayIndex(expiresAt)) return formatDay(startsAt, language);
    return `${formatDay(startsAt, language)} – ${formatDay(expiresAt, language)}`;
  }
  if (startsAt) return t('activityWhen.fromDate', { date: formatDay(startsAt, language) });
  if (expiresAt) return t('activityWhen.untilDate', { date: formatDay(expiresAt, language) });
  return null;
}

export type ActivityWhen = 'ended' | 'lastDay' | 'today' | 'tomorrow' | 'inDays' | 'onNow';

/**
 * Whole local days, not hours. Dates are stored pinned to the edges of a day
 * (see above), so "tomorrow" has to mean the calendar's tomorrow — comparing
 * instants would call something 23 hours away "today".
 *
 * 'lastDay' and 'tomorrow' are deliberately the same two moments the reminder
 * push fires on, so the screen and the notification never contradict each other.
 */
export function activityWhen(
  startsAt: string | null,
  expiresAt: string | null,
  now: Date = new Date()
): ActivityWhen | null {
  if (!startsAt && !expiresAt) return null;
  const today = Math.floor(startOfLocalDay(now).getTime() / 86_400_000);
  const start = startsAt ? localDayIndex(startsAt) : null;
  const end = expiresAt ? localDayIndex(expiresAt) : null;

  if (end !== null && end < today) return 'ended';
  if (end !== null && end === today && (start === null || start < today)) return 'lastDay';
  if (start !== null && start === today) return 'today';
  if (start !== null && start === today + 1) return 'tomorrow';
  if (start !== null && start > today) return 'inDays';
  return 'onNow';
}

export function activityWhenLabel(
  when: ActivityWhen,
  startsAt: string | null,
  t: TFunction
): string {
  if (when === 'inDays' && startsAt) {
    const days = localDayIndex(startsAt) - Math.floor(startOfLocalDay(new Date()).getTime() / 86_400_000);
    return t('activityWhen.inDays', { count: days });
  }
  return t(`activityWhen.${when}`);
}
