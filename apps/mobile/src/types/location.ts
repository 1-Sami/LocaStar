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
  /** Metres from the searching user, unrounded. null when it isn't known. */
  distanceM: number | null;
  /**
   * Where the place actually is. Null for saved/list rows, which are not
   * fetched with coordinates — Directions falls back to a name search there.
   */
  coords: { lat: number; lng: number } | null;
  /** null when the location has no photo — cards show a placeholder instead. */
  imageUrl: string | null;
  startsAt: string | null;
};
