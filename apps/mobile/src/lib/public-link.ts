// The deployed public web build. This was left pointing at locastar.app — a
// domain LocaStar does not own — from before the web build existed, so every
// shared link led nowhere. The site is at locastar.se (see auth-redirect.ts
// and the Android App Links host in app.json), and scripts/build-web.mjs
// publishes /location/<id> there. Override via EXPO_PUBLIC_WEB_BASE_URL to
// point a build at a preview deployment instead.
const WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'https://locastar.se';

export function buildLocationShareLink(locationId: string): string {
  return `${WEB_BASE_URL}/location/${locationId}`;
}
