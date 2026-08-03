import type { ListItemLocation, NearbyLocation, SavedLocation } from '@locastar/shared';

import { supabase } from '@/lib/supabase';
import type { CardLocation } from '@/types/location';

/**
 * Public URL for a photo in the media bucket, or null when there isn't one.
 *
 * Cards used to fill the gap with a random stock photo, which read as an image
 * whoever added the place had chosen. A location with no photo now says so.
 */
function photoUrl(storagePath: string | null): string | null {
  if (!storagePath) return null;
  return supabase.storage.from('media').getPublicUrl(storagePath).data.publicUrl;
}

export function nearbyLocationToCard(location: NearbyLocation): CardLocation {
  return {
    id: location.id,
    kind: location.kind,
    name: location.name,
    categorySlug: location.category_slug ?? 'default',
    categoryLabel: location.category_label ?? 'Other',
    rating: location.avg_rating,
    reviewCount: location.review_count,
    description: location.description ?? '',
    address: location.address,
    city: location.city,
    country: location.country,
    distanceM: location.distance_m,
    imageUrl: photoUrl(location.cover_photo_path),
    startsAt: location.starts_at,
  };
}

export function savedLocationToCard(location: SavedLocation): CardLocation {
  return {
    id: location.location_id,
    kind: location.kind,
    name: location.name,
    categorySlug: location.category_slug ?? 'default',
    categoryLabel: location.category_slug ?? 'Other',
    rating: location.avg_rating,
    reviewCount: location.review_count,
    description: location.description ?? '',
    address: location.address,
    city: location.city,
    country: location.country,
    distanceM: null,
    imageUrl: photoUrl(location.cover_photo_path),
    startsAt: null,
  };
}

export function listItemToCard(item: ListItemLocation): CardLocation {
  return {
    id: item.locationId,
    kind: item.kind,
    name: item.name,
    categorySlug: item.categorySlug ?? 'default',
    categoryLabel: item.categorySlug ?? 'Other',
    rating: item.avgRating,
    reviewCount: item.reviewCount,
    description: item.description ?? '',
    address: item.address,
    city: item.city,
    country: item.country,
    distanceM: null,
    // fetchListItems already resolves this to a public URL.
    imageUrl: item.imageUrl,
    startsAt: null,
  };
}
