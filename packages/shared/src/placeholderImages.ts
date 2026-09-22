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
  "4h-farms": { file: "farm.webp", focusY: 60 },
  "action-parks": { file: "action-park.webp", focusY: 50 },
  "amerikan-fotball": { file: "american-football.webp", focusY: 38 },
  "archery-ranges": { file: "archery.webp", focusY: 62 },
  baseball: { file: "baseball.webp", focusY: 85 },
  basketball: { file: "basketball.webp", focusY: 40 },
  beaches: { file: "beach.webp", focusY: 75 },
  "bike-trails": { file: "bike-trail.webp", focusY: 82 },
  birdwatching: { file: "birdwatching.webp", focusY: 55 },
  bmx: { file: "bmx.webp", focusY: 85 },
  bowling: { file: "bowling.webp", focusY: 68 },
  boule: { file: "boule.webp", focusY: 85 },
  camping: { file: "camping.webp", focusY: 70 },
  climbing: { file: "climbing.webp", focusY: 65 },
  cricket: { file: "cricket.webp", focusY: 88 },
  "disc-golf-frisbee": { file: "disc-golf.webp", focusY: 65 },
  "diving-spots": { file: "diving.webp", focusY: 62 },
  "dog-parks": { file: "dog-park.webp", focusY: 85 },
  fishing: { file: "fishing.webp", focusY: 75 },
  football: { file: "football.webp", focusY: 85 },
  golf: { file: "golf.webp", focusY: 78 },
  "grill-sites": { file: "grill-site.webp", focusY: 85 },
  "gyms-outside": { file: "outdoor-gym.webp", focusY: 60 },
  hiking: { file: "hiking.webp", focusY: 78 },
  "historical-ruins-places": { file: "ruins.webp", focusY: 68 },
  "horse-track": { file: "horse-track.webp", focusY: 78 },
  "ice-skating": { file: "ice-skating.webp", focusY: 75 },
  "jogging-trails": { file: "jogging-trail.webp", focusY: 85 },
  library: { file: "library.webp", focusY: 65 },
  "mini-golf": { file: "mini-golf.webp", focusY: 58 },
  "motocross-atv-tracks": { file: "motocross.webp", focusY: 88 },
  "museums-free": { file: "museum.webp", focusY: 58 },
  // A boardwalk, a lake and a trail marker.
  "nature-reserves": { file: "nature-trail.webp", focusY: 80 },
  "obstacle-course": { file: "obstacle-course.webp", focusY: 85 },
  // "Outdoor recreation area": a wind shelter and a fire by the water.
  outdoor: { file: "shelter.webp", focusY: 78 },
  paintball: { file: "paintball.webp", focusY: 78 },
  parkour: { file: "parkour.webp", focusY: 72 },
  "picknick-parks": { file: "park.webp", focusY: 82 },
  playgrounds: { file: "playground.webp", focusY: 78 },
  "public-art": { file: "public-art.webp", focusY: 62 },
  "race-tracks-vehicle": { file: "race-track.webp", focusY: 75 },
  "rc-race-track": { file: "rc-race-track.webp", focusY: 85 },
  roads: { file: "road.webp", focusY: 78 },
  "scenic-place": { file: "viewpoint.webp", focusY: 70 },
  "shooting-range": { file: "shooting-range.webp", focusY: 80 },
  skatepark: { file: "skatepark.webp", focusY: 82 },
  skiing: { file: "ski-slope.webp", focusY: 82 },
  swimming: { file: "pool.webp", focusY: 82 },
  tennis: { file: "tennis.webp", focusY: 78 },
  "track-and-field-stadium": { file: "athletics.webp", focusY: 78 },
  volleyball: { file: "volleyball.webp", focusY: 80 },
  "water-activities": { file: "kayak.webp", focusY: 80 },
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
