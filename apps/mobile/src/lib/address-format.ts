/**
 * Turning what the geocoder says into the two address lines the forms use.
 *
 * These lived inside add-location.tsx, which was fine while that was the only
 * screen reverse-geocoding a pin. Editing a place now does it too, and the one
 * thing worse than no address is two screens disagreeing about how to write it.
 */
import type { LocationGeocodedAddress } from 'expo-location';

export function formatStreetLine(result: LocationGeocodedAddress): string {
  // Swedish street addresses put the number after the name (e.g. "Sturevägen 6"),
  // so build from `street`/`streetNumber` directly rather than the ambiguous
  // `name` field, whose ordering isn't consistent across platforms.
  return [result.street, result.streetNumber].filter(Boolean).join(' ');
}

export function resolveCity(result: LocationGeocodedAddress): string | null {
  // `city` frequently comes back null from the geocoder for addresses outside
  // a major urban core — fall back to the district/subregion, which is
  // usually the actual town/city name in that case.
  return result.city || result.subregion || result.district || null;
}

export function formatCityLine(result: LocationGeocodedAddress): string {
  return [result.postalCode, resolveCity(result)].filter(Boolean).join(' ');
}
