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
  distanceKm: number | null;
  imageUrl: string;
};
