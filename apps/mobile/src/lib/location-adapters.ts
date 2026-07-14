import type { NearbyLocation, SavedLocation } from '@locastar/shared';

import type { CardLocation } from '@/types/location';

export function placeholderImage(seed: string) {
  return `https://picsum.photos/seed/locastar-${seed}/640/480`;
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
    distanceKm: Math.round(location.distance_m / 100) / 10,
    imageUrl: placeholderImage(location.id),
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
    distanceKm: null,
    imageUrl: placeholderImage(location.location_id),
  };
}
