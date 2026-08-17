/**
 * Where an uploaded photo goes in the media bucket.
 *
 * Written out identically in three screens before this, which is two chances
 * for the shape to drift — and the shape matters: the purge job deletes storage
 * objects by the paths recorded in the database, so a file stored under a path
 * nobody expects is a file nobody can ever remove.
 *
 * Also a real fix for a lint error rather than a cosmetic one. Date.now() and
 * Math.random() inside a component body are flagged as impure calls during
 * render, and although these ran inside submit handlers where that is perfectly
 * legal, the compiler cannot prove it. Out here the question does not arise.
 */
function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** A photo belonging to the place itself. */
export function locationPhotoPath(locationId: string): string {
  return `locations/${locationId}/${uniqueSuffix()}.jpg`;
}

/** A photo attached to a review. */
export function reviewPhotoPath(reviewId: string): string {
  return `reviews/${reviewId}/${uniqueSuffix()}.jpg`;
}
