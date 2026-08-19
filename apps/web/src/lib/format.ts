import { CategoryColors } from '@locastar/shared';

/** Category tile / badge / border colour, falling back to the map's own default. */
export function categoryColor(slug: string | null): string {
  if (!slug) return CategoryColors.default;
  return CategoryColors[slug] ?? CategoryColors.default;
}

/**
 * The rating line.
 *
 * 989 of 996 locations have no reviews, so this is the common branch, not the
 * edge case. Never a row of empty stars — the handoff is explicit, and empty
 * stars read as "rated badly" rather than "not rated".
 */
export function ratingLabel(avg: number, count: number): { rated: false } | { rated: true; stars: string; avg: string; count: number } {
  if (!count || !avg) return { rated: false };
  return {
    rated: true,
    stars: '★'.repeat(Math.round(avg)) + '☆'.repeat(Math.max(0, 5 - Math.round(avg))),
    avg: avg.toFixed(1),
    count,
  };
}

/** "2 weeks ago" — mono, uppercase, as the mockup sets it. */
export function relativeDate(iso: string, now = Date.now()): string {
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return 'TODAY';
  if (days === 1) return 'YESTERDAY';
  if (days < 7) return `${days} DAYS AGO`;
  if (days < 14) return '1 WEEK AGO';
  if (days < 60) return `${Math.floor(days / 7)} WEEKS AGO`;
  if (days < 365) return `${Math.floor(days / 30)} MONTHS AGO`;
  const years = Math.floor(days / 365);
  return years === 1 ? '1 YEAR AGO' : `${years} YEARS AGO`;
}

export function longDate(iso: string, locale = 'en-GB'): string {
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Meta description from the place's own words.
 *
 * Truncated on a word boundary at ~155 characters. Explicitly *not* a template
 * with the name substituted in — Google discards those, and they tell a reader
 * nothing the title did not already say. Falls back to the one honest sentence
 * we can always write: what it is and where.
 */
export function metaDescription(
  description: string | null,
  fallback: { name: string; category: string | null; city: string | null }
): string {
  const text = description?.trim();
  if (text) {
    if (text.length <= 155) return text;
    const cut = text.slice(0, 155);
    return cut.slice(0, cut.lastIndexOf(' ')).trimEnd() + '…';
  }
  const what = fallback.category ? `${fallback.category}` : 'A place to go';
  const where = fallback.city ? ` in ${fallback.city}` : '';
  return `${fallback.name} — ${what}${where}, on LocaStar. Directions, photos and reviews from people who have been there.`;
}
