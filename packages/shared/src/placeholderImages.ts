/*
 * An illustration for a place that has no photo yet, keyed by category slug.
 *
 * Shown only in the gap: the moment a place has a real photo, that photo is
 * its cover and this is never asked. Nothing is written to the database for
 * it — no location_photos row, no uploader, nothing to report or clean up —
 * so "replaced as soon as someone uploads one" needs no code of its own.
 *
 * Cards once filled the gap with random stock photos, which read as a picture
 * whoever added the place had chosen (apps/mobile/src/lib/location-adapters.ts).
 * These are flat drawings, not photographs of anywhere, so they cannot be
 * mistaken for the place itself; the place pages label them all the same.
 *
 * The files are served by the website (apps/web/public/placeholders/) and the
 * app loads them from there by URL, so there is one copy of each and adding
 * one is a file plus a line here. A category without an entry keeps the flat
 * category-colour tile it had before.
 */

const BASE = "https://locastar.se/placeholders/";

/*
 * focusY is how far down the drawing its subject sits, as a CSS background
 * position. The drawings are 4:3 and the website's place-page banner is about
 * 3.4:1, so it shows barely a third of the height — centred, that cut the top
 * off the basketball hoop and showed the dog park as a strip of fence. Each
 * value was checked against a rendered crop of the banner.
 */
const IMAGES: Record<string, { file: string; focusY: number }> = {
  basketball: { file: "basketball.webp", focusY: 40 },
  "dog-parks": { file: "dog-park.webp", focusY: 85 },
  golf: { file: "golf.webp", focusY: 78 },
  "ice-skating": { file: "ice-skating.webp", focusY: 75 },
  "mini-golf": { file: "mini-golf.webp", focusY: 58 },
  // A boardwalk, a lake and a trail marker: both a reserve and a hiking trail.
  "nature-reserves": { file: "nature-trail.webp", focusY: 80 },
  hiking: { file: "nature-trail.webp", focusY: 80 },
  "gyms-outside": { file: "outdoor-gym.webp", focusY: 60 },
  playgrounds: { file: "playground.webp", focusY: 78 },
  skiing: { file: "ski-slope.webp", focusY: 82 },
  football: { file: "football.webp", focusY: 85 },
};

/** The illustration's URL for a category, or null when it has none. */
export function placeholderImageUrl(categorySlug: string | null | undefined): string | null {
  const image = categorySlug ? IMAGES[categorySlug] : undefined;
  return image ? BASE + image.file : null;
}

/** Where to crop the illustration vertically in a wide frame, 0–100 (%). */
export function placeholderFocusY(categorySlug: string | null | undefined): number {
  return (categorySlug && IMAGES[categorySlug]?.focusY) || 50;
}
