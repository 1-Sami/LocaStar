import { Platform } from 'react-native';

/** Where auth emails land when there's no browser origin to borrow. */
const PRODUCTION_ORIGIN = 'https://locastar.se';

/**
 * The app's own scheme, from `expo.scheme` in app.json.
 *
 * Only for handing off *from* an already-opened web page — never as the target
 * of an email link, for the reason spelled out on `authRedirectTo` below.
 */
export const APP_SCHEME_URL = 'locastar://';

/**
 * Where a link in an auth email should send someone.
 *
 * Auth mail gets opened wherever the person reads their mail — usually a
 * desktop or webmail browser — so the target has to be an https address.
 * The password reset link was once hardcoded to `locastar://reset-password`,
 * the native deep-link scheme, and a browser has no handler for it, so the
 * link silently did nothing. On a phone with the app installed the OS can
 * still hand an https link to the app.
 *
 * On web, prefer the current origin so a preview deployment or a local dev
 * server sends you back to itself rather than to production.
 *
 * Passing this explicitly matters: without a `redirectTo`, Supabase falls
 * back to the project's Site URL. That happens to be right today, but it is
 * a dashboard setting nothing in this repo controls, and it was
 * `http://localhost:3000` as recently as 2026-07-31 — which is exactly how
 * confirmation links ended up on a dead page.
 */
export function authRedirectTo(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${suffix}`;
  }
  return `${PRODUCTION_ORIGIN}${suffix}`;
}
