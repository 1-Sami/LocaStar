import type { ListItemLocation, NearbyLocation, SavedLocation } from '@locastar/shared';

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
    distanceKm: null,
    imageUrl: placeholderImage(location.location_id),
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
    distanceKm: null,
    imageUrl: placeholderImage(item.locationId),
    startsAt: null,
  };
}
