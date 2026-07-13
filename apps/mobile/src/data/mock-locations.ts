export type LocationKind = 'place' | 'activity';

export type MockLocation = {
  id: string;
  kind: LocationKind;
  name: string;
  categorySlug: string;
  categoryLabel: string;
  rating: number;
  reviewCount: number;
  description: string;
  distanceKm: number;
  imageUrl: string;
};

export const mockLocations: MockLocation[] = [
  {
    id: 'stockholm-golfklubb',
    kind: 'place',
    name: 'Stockholm Golfklubb',
    categorySlug: 'golf',
    categoryLabel: 'Golf',
    rating: 4.5,
    reviewCount: 152,
    description:
      'Founded in 1904 — the second oldest golf club in Sweden. A beautifully maintained parkland course near Danderyd with over 120 years of history.',
    distanceKm: 40,
    imageUrl: 'https://picsum.photos/seed/locastar-golf-1/640/480',
  },
  {
    id: 'grodinge-golfklubb',
    kind: 'place',
    name: 'Grödinge Golfklubb',
    categorySlug: 'golf',
    categoryLabel: 'Golf',
    rating: 3.0,
    reviewCount: 63,
    description: 'A relaxed, welcoming course south of Stockholm, popular with local weekend players.',
    distanceKm: 40,
    imageUrl: 'https://picsum.photos/seed/locastar-golf-2/640/480',
  },
  {
    id: 'brukets-skidbacke',
    kind: 'place',
    name: 'Brukets Skidbacke',
    categorySlug: 'skiing',
    categoryLabel: 'Skiing',
    rating: 4.5,
    reviewCount: 46,
    description: 'A small but scenic ski slope with well-groomed runs for beginners and families.',
    distanceKm: 40,
    imageUrl: 'https://picsum.photos/seed/locastar-ski-1/640/480',
  },
  {
    id: 'ekebybacken',
    kind: 'place',
    name: 'Ekebybacken',
    categorySlug: 'skiing',
    categoryLabel: 'Skiing',
    rating: 4.5,
    reviewCount: 46,
    description: 'Steeper runs and a great view over the valley — a favorite for more experienced skiers.',
    distanceKm: 40,
    imageUrl: 'https://picsum.photos/seed/locastar-ski-2/640/480',
  },
  {
    id: 'bmx-haninge',
    kind: 'place',
    name: 'BMX Haninge',
    categorySlug: 'bmx',
    categoryLabel: 'BMX',
    rating: 4.5,
    reviewCount: 46,
    description: 'A dirt BMX track with jumps for all skill levels, tucked into the forest outside Haninge.',
    distanceKm: 40,
    imageUrl: 'https://picsum.photos/seed/locastar-bmx-1/640/480',
  },
  {
    id: 'flottsbro',
    kind: 'place',
    name: 'Flottsbro',
    categorySlug: 'outdoor',
    categoryLabel: 'Outdoor',
    rating: 4.5,
    reviewCount: 46,
    description: 'Rolling green hills popular for hiking, sledding in winter, and picnics in summer.',
    distanceKm: 12,
    imageUrl: 'https://picsum.photos/seed/locastar-outdoor-1/640/480',
  },
  {
    id: 'haninge-mat-festival',
    kind: 'activity',
    name: 'Haninge Mat festival',
    categorySlug: 'festival',
    categoryLabel: 'Festival',
    rating: 4.5,
    reviewCount: 46,
    description: 'An annual food festival with local vendors, live music, and family activities.',
    distanceKm: 15,
    imageUrl: 'https://picsum.photos/seed/locastar-festival-1/640/480',
  },
];

export const mockCategories = [
  { slug: 'golf', label: 'Golf' },
  { slug: 'swimming', label: 'Swimming' },
  { slug: 'bmx', label: 'BMX' },
  { slug: 'skiing', label: 'Skiing' },
  { slug: 'outdoor', label: 'Outdoor' },
  { slug: 'festival', label: 'Festival' },
];
