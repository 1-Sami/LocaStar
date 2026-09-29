import { CategoryColors, placeholderFocusY, placeholderImageUrl } from '@locastar/shared';

/**
 * The inline style for a cover tile: the place's photo, or — with none — its
 * category's illustration, cropped on the drawing's subject rather than its
 * middle (see placeholderImages.ts in shared). Null when there is neither, for
 * the flat category-colour tile.
 */
export function coverStyle(photoUrl: string | null, categorySlug: string | null | undefined): string | null {
  if (photoUrl) return `background-image:url("${photoUrl}")`;
  const illustration = placeholderImageUrl(categorySlug);
  if (!illustration) return null;
  return `background-image:url("${illustration}");background-position:center ${placeholderFocusY(categorySlug)}%`;
}

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
/*
 * How long ago, in the reader's language.
 *
 * The language argument is not optional, and deliberately so: this read "3 DAYS
 * AGO" on the Swedish place page for as long as the page has existed, because
 * an optional parameter is one every caller forgets. There is exactly one
 * caller, and now it cannot.
 */
export function relativeDate(iso: string, lang: 'en' | 'sv', now = Date.now()): string {
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (lang === 'sv') {
    if (days < 1) return 'I DAG';
    if (days === 1) return 'I GÅR';
    if (days < 7) return `FÖR ${days} DAGAR SEDAN`;
    if (days < 14) return 'FÖR EN VECKA SEDAN';
    if (days < 60) return `FÖR ${weeks} VECKOR SEDAN`;
    if (days < 365) return `FÖR ${months} MÅNADER SEDAN`;
    return years === 1 ? 'FÖR ETT ÅR SEDAN' : `FÖR ${years} ÅR SEDAN`;
  }

  if (days < 1) return 'TODAY';
  if (days === 1) return 'YESTERDAY';
  if (days < 7) return `${days} DAYS AGO`;
  if (days < 14) return '1 WEEK AGO';
  if (days < 60) return `${weeks} WEEKS AGO`;
  if (days < 365) return `${months} MONTHS AGO`;
  return years === 1 ? '1 YEAR AGO' : `${years} YEARS AGO`;
}

/**
 * "25–27 Sept" for an event, or "28 Sept – 3 Oct" when it crosses a month.
 *
 * Both ends, because an event is a span: a festival listed as its first day
 * reads as over the moment that day passes, which is the opposite of true.
 */
/*
 * Event dates are Swedish calendar dates, and must be formatted as such.
 *
 * Migration 0092 pins starts_at to local midnight, so an event on the 29th is
 * stored as 22:00 UTC on the *28th*. This Worker runs in UTC, so formatting
 * that instant without a timezone printed the day before — every event on the
 * site started a day early, on the cards and in the countdown both. It read
 * correctly in the app only because a phone in Sweden is already on this clock.
 *
 * Pinned rather than taken from the reader: the festival opens on the 29th in
 * Linköping whether you are reading in Malmö or in Tokyo.
 */
const EVENT_TZ = 'Europe/Stockholm';

/** Y/M/D as Sweden sees them. en-CA because it yields YYYY-MM-DD. */
function stockholmParts(d: Date): { year: number; month: number; day: number } {
  const [year, month, day] = d
    .toLocaleDateString('en-CA', { timeZone: EVENT_TZ })
    .split('-')
    .map(Number);
  return { year, month, day };
}

/**
 * Whole days from today until an event starts, counted in Swedish days.
 *
 * Comparing instants would make "tomorrow" read as 0 days for anything less
 * than 24 hours away; comparing UTC days would shift the boundary two hours
 * into the previous evening.
 */
export function eventDaysUntil(startIso: string, now = new Date()): number {
  const a = stockholmParts(new Date(startIso));
  const b = stockholmParts(now);
  return Math.round(
    (Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day)) / 86_400_000
  );
}

export function dateRange(startIso: string | null, endIso: string | null, locale = 'en-GB'): string {
  if (!startIso) return '';
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  const dayMonth = (d: Date) =>
    d.toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: EVENT_TZ });
  if (!end) return dayMonth(start);

  const a = stockholmParts(start);
  const b = stockholmParts(end);
  if (a.year === b.year && a.month === b.month && a.day === b.day) return dayMonth(start);

  const sameMonth = a.year === b.year && a.month === b.month;
  return sameMonth
    ? `${start.toLocaleDateString(locale, { day: 'numeric', timeZone: EVENT_TZ })}–${dayMonth(end)}`
    : `${dayMonth(start)} – ${dayMonth(end)}`;
}

/**
 * The same range, spelled out with the month and year, for a page rather than
 * a card. "29 september – 3 oktober 2026".
 */
export function longDateRange(
  startIso: string | null,
  endIso: string | null,
  locale = 'en-GB'
): string {
  if (!startIso) return '';
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  const full = (d: Date) =>
    d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: EVENT_TZ });
  if (!end) return full(start);

  const a = stockholmParts(start);
  const b = stockholmParts(end);
  if (a.year === b.year && a.month === b.month && a.day === b.day) return full(start);

  // The year is said once, at the end, unless the event crosses into another.
  if (a.year === b.year && a.month === b.month) {
    return `${start.toLocaleDateString(locale, { day: 'numeric', timeZone: EVENT_TZ })}–${full(end)}`;
  }
  if (a.year === b.year) {
    const dayMonth = start.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      timeZone: EVENT_TZ,
    });
    return `${dayMonth} – ${full(end)}`;
  }
  return `${full(start)} – ${full(end)}`;
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

/**
 * A count as a round figure it will not outgrow — "900+", "40+".
 *
 * The owner asked for approximate numbers rather than exact ones, so the copy
 * does not need rewriting every time the map grows. It always rounds *down*:
 * 998 becomes "900+", not "1000+", because 998 is not a thousand and a site
 * whose own numbers are wrong is not one to trust about anything else. It
 * starts saying "1000+" on its own the day there are 1000.
 */
export function roundedCount(value: number): string {
  if (value < 10) return String(value);
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const step = magnitude >= 1000 ? magnitude : magnitude;
  const floored = Math.floor(value / step) * step;
  return `${floored}+`;
}

/**
 * Categories in the order a filter list should offer them.
 *
 * Alphabetical by the name actually on screen, not by slug — the slugs are
 * English, so sorting on them puts the Swedish list in an order that looks
 * random ("Utomhusgym" filed under g).
 *
 * localeCompare with the page's language, because Swedish sorts å, ä and ö
 * after z rather than beside a and o. A plain `<` comparison gets that wrong
 * for exactly the letters a Swedish reader would notice.
 *
 * "Others" is pushed to the end whatever it is called. It is the bucket for
 * everything that did not fit, so it belongs after the real answers rather
 * than alphabetised into the middle of them.
 */
export function byCategoryName<T extends { slug: string; name: string }>(
  rows: readonly T[],
  lang: 'en' | 'sv',
  displayName: (row: T) => string
): T[] {
  return [...rows].sort((a, b) => {
    if (a.slug === 'other') return 1;
    if (b.slug === 'other') return -1;
    return displayName(a).localeCompare(displayName(b), lang);
  });
}
