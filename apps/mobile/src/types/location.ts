export type LocationKind = 'place' | 'activity';

export type CardLocation = {
  id: string;
  kind: LocationKind;
  name: string;
  categorySlug: string;
  categoryLabel: string;
  rating: number;
  reviewCount: number;
  description: string;
  address: string | null;
  city: string | null;
  country: string | null;
  distanceKm: number | null;
  /** null when the location has no photo — cards show a placeholder instead. */
  imageUrl: string | null;
  startsAt: string | null;
};
