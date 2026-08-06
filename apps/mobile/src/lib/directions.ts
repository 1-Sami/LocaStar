import { Linking, Platform } from 'react-native';

/**
 * Opens turn-by-turn directions to a location.
 *
 * TAKES COORDINATES, NOT AN ADDRESS. This used to pass the address string and
 * let Google or Apple geocode it, which is wrong for most of what LocaStar
 * lists. A basketball court in a park has no street number, so the address is
 * something like "Furuholmsstigen, 127 47 Stockholm" — a whole street. Handed
 * that, Google routes to the middle of the street, or to an arbitrary building
 * range on it ("Fleminggatan 47-45"), or fails to resolve it at all. People
 * arrive a hundred metres away, find nothing, and reasonably conclude the
 * listing is wrong.
 *
 * The coordinates are the accurate part and were being thrown away. A court
 * behind a building, on a beach, or between blocks of flats is exactly the case
 * where a street name is useless and a point is not.
 *
 * The label is only what the destination is called once you arrive; every
 * platform below routes on the numbers.
 */
export function openDirections(
  coords: { lat: number; lng: number } | null,
  label: string
): void {
  const encodedLabel = encodeURIComponent(label);

  // No coordinates: fall back to searching the name. Worse, but better than a
  // dead button — and every location in the database has a point, so this is
  // for saved/list rows the app has not loaded coordinates for.
  if (!coords) {
    const webFallback = `https://www.google.com/maps/dir/?api=1&destination=${encodedLabel}`;
    Linking.openURL(webFallback).catch(() => {});
    return;
  }

  const point = `${coords.lat},${coords.lng}`;
  const webFallback =
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(point)}`;

  const url = Platform.select({
    // Apple Maps takes "lat,lng" in daddr and shows the label if given.
    ios: `https://maps.apple.com/?daddr=${encodeURIComponent(point)}&q=${encodedLabel}`,
    // google.navigation:q accepts a raw coordinate pair and starts navigating.
    android: `google.navigation:q=${point}`,
    default: webFallback,
  });

  Linking.openURL(url).catch(() => Linking.openURL(webFallback));
}
