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
