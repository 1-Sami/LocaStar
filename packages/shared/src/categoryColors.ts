/*
 * Category colours, keyed by the slug in the `categories` table.
 *
 * Lives here rather than in either app because both render it and it is keyed
 * by database data — a second copy would drift the first time a category is
 * added. The mobile theme re-exports it so app code is unchanged.
 */
export const CategoryColors: Record<string, string> = {
  // Water & coast
  swimming: '#163A4A',
  'water-activities': '#0F4C5C',
  beaches: '#1C6E7A',
  'diving-spots': '#0E3F52',
  fishing: '#2A5B6B',

  // Winter
  skiing: '#1B2A4A',
  'ice-skating': '#3A5B8C',

  // Ball sports
  football: '#1F5C33',
  basketball: '#7A3B12',
  baseball: '#5C1F1F',
  cricket: '#5C4B1F',
  golf: '#4C5A26',
  'amerikan-fotball': '#6B2E1A',
  volleyball: '#8A5A1E',
  tennis: '#7A6B14',
  boule: '#6B5A3A',
  'mini-golf': '#3F6B2E',
  'disc-golf-frisbee': '#4A6B33',

  // Wheels & motor
  roads: '#4A4A52',
  bmx: '#6B7A2E',
  skatepark: '#4A3F5C',
  'motocross-atv-tracks': '#5C3A1E',
  'race-tracks-vehicle': '#3A3F4A',
  'rc-race-track': '#4A5568',
  'horse-track': '#6B4A2E',

  // Nature & trails
  'bike-trails': '#2E4A1F',
  hiking: '#2A5C3F',
  'jogging-trails': '#386B4A',
  'nature-reserves': '#1F4A2E',
  birdwatching: '#4A6B52',
  camping: '#33502E',
  outdoor: '#3F5C33',
  'scenic-place': '#2E5C52',

  // Parks & family
  'picknick-parks': '#4A5C2E',
  'dog-parks': '#5C4A2E',
  playgrounds: '#7A3B5C',
  'grill-sites': '#6B3A2E',
  'action-parks': '#8A4A2E',
  '4h-farms': '#5C5C2E',

  // Challenge & training
  'gyms-outside': '#6B3F1D',
  climbing: '#5C3F2E',
  parkour: '#4A3A5C',
  'obstacle-course': '#5C2E4A',
  'archery-ranges': '#4A5C5C',
  'shooting-range': '#3F4A52',
  paintball: '#6B2E4A',
  'track-and-field-stadium': '#8A5A2E',

  // Indoor
  bowling: '#4A2E5C',

  // Culture & other
  festival: '#5C1B3A',
  'historical-ruins-places': '#5C4A5C',
  'public-art': '#6B3A6B',
  library: '#3A4A6B',
  'museums-free': '#5C3A6B',

  // "Others" is the catch-all, so reading as unclassified is correct.
  other: '#33363B',
  default: '#33363B',
};
