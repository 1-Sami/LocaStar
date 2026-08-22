/*
 * Where we are allowed to send somebody after a form post.
 *
 * `back` and `next` are carried in form fields and query strings, so they are
 * caller-supplied and cannot be handed to redirect() as they are — that is an
 * open redirect, and a sign-in page that will forward to any address is a
 * useful thing to put in a phishing email.
 *
 * Astro's origin check already refuses the cross-site POST that would set one
 * of these today, so this is not a hole being closed so much as one being kept
 * shut: the moment `next` starts being honoured after sign-in, an unchecked
 * value becomes a working redirect.
 *
 * Only a path on this site is accepted. `//evil.com` and `/\evil.com` both
 * begin with a slash and both leave the site, so they are rejected too.
 */
export function safePath(value: string | null | undefined, fallback = '/'): string {
  if (!value) return fallback;
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}
