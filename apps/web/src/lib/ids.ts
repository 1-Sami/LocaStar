/*
 * Is this string shaped like an id we could look up?
 *
 * Postgres rejects a malformed uuid with an error, not an empty result, so
 * `/location/xyz` used to reach the catch written for "the database is down"
 * and answer 503. That is the wrong thing to tell a crawler: 503 says come
 * back later, so a mistyped share link stays in the index and keeps being
 * re-fetched, where 404 retires it.
 *
 * Checked here rather than caught after the fact — there is no reason to ask
 * the database about a string that cannot be an id.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | undefined): value is string {
  return typeof value === 'string' && UUID.test(value);
}
