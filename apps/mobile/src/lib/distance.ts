/**
 * Straight-line distance in metres. Haversine, on a mean Earth radius.
 *
 * Search results get distance_m from nearby_locations, but opening a location
 * directly — from a share link, or the map — never runs that query, so those
 * screens have to work it out from the coordinates they already hold.
 * "As the crow flies", same as the cards: the walking route is longer, and
 * quoting one without a routing service would be a guess.
 */
export function metresBetween(
  a: { latitude: number; longitude: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.latitude);
  const dLng = toRad(b.lng - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * How far the place is from the person looking at it.
 *
 * Metres below a kilometre, because "0.4 km" reads as further away than
 * "400 m". Rounding happens here and nowhere else — the card used to quantise
 * to the nearest 100 m on the way in, which turned everything closer than 50 m
 * into a flat "0 m".
 */
export function formatDistance(metres: number | null): string | null {
  if (metres === null) return null;
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}
