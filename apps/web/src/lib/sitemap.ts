import type { SitemapEntry } from '@locastar/shared';

/*
 * One sitemap became eight, because Search Console reports coverage per
 * submitted sitemap and nothing finer.
 *
 * A single file of 17,671 URLs answered "how is indexing going?" with one
 * number for every kind of page at once, which is how indexing could sit at
 * roughly seventeen pages for weeks with no way to tell whether the town pages
 * were working, the category pages were working, or neither. Split by type, the
 * Pages report answers it directly: towns 280/320, places 4/24, and so on.
 *
 * Language is split too, for the pages that have a real Swedish version. "Does
 * the Swedish half of the site index at all?" has never had an answer either.
 */
export const SITEMAP_PARTS = [
  'static',
  'categories',
  'categories-sv',
  'towns',
  'towns-sv',
  'places',
  'lists',
] as const;

export type SitemapPart = (typeof SITEMAP_PARTS)[number];

export const isSitemapPart = (value: string): value is SitemapPart =>
  (SITEMAP_PARTS as readonly string[]).includes(value);

/**
 * The pages that always exist, independent of any data.
 *
 * /categories is the hub every activity page hangs off, so leaving it out was
 * the costliest of the three omissions here.
 */
const STATIC_PATHS = [
  '/',
  '/search',
  '/categories',
  '/community',
  '/about',
  '/features',
  '/contact',
  '/legal/privacy',
  '/legal/terms',
  '/legal/delete-account',
];

/*
 * Pages with no Swedish version.
 *
 * The legal documents are published in English only — the version Apple and
 * Google reviewed. /sv/legal/privacy renders that same English text, so listing
 * it would be offering Google a second address for one page.
 */
const ENGLISH_ONLY = ['/legal/privacy', '/legal/terms', '/legal/delete-account'];

const sv = ({ path, lastmod }: SitemapEntry): SitemapEntry => ({
  path: path === '/' ? '/sv/' : `/sv${path}`,
  lastmod,
});

export const escapeXml = (value: string) =>
  value.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      default:
        return '&quot;';
    }
  });

type Entries = {
  locations: SitemapEntry[];
  lists: SitemapEntry[];
  categories: SitemapEntry[];
  towns: SitemapEntry[];
};

/**
 * Which URLs belong in one child sitemap.
 *
 * Every part is listed in exactly one child. A URL in two of them is a URL
 * Google is invited to crawl twice, and the point of the split is to spend the
 * budget deliberately.
 *
 * `places` has no Swedish twin on purpose — see the sitemap index route.
 */
export function partUrls(part: SitemapPart, entries: Entries): SitemapEntry[] {
  switch (part) {
    case 'static': {
      const english: SitemapEntry[] = STATIC_PATHS.map((path) => ({ path, lastmod: null }));
      return [...english, ...english.filter(({ path }) => !ENGLISH_ONLY.includes(path)).map(sv)];
    }
    case 'categories':
      return entries.categories;
    case 'categories-sv':
      return entries.categories.map(sv);
    case 'towns':
      return entries.towns;
    case 'towns-sv':
      return entries.towns.map(sv);
    case 'places':
      return entries.locations;
    case 'lists':
      return [...entries.lists, ...entries.lists.map(sv)];
  }
}

export const renderUrlset = (origin: string, urls: SitemapEntry[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(({ path, lastmod }) => {
    const loc = `  <url>\n    <loc>${escapeXml(origin + path)}</loc>`;
    const mod = lastmod
      ? `\n    <lastmod>${escapeXml(new Date(lastmod).toISOString().slice(0, 10))}</lastmod>`
      : '';
    return `${loc}${mod}\n  </url>`;
  })
  .join('\n')}
</urlset>
`;

export const renderIndex = (origin: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${SITEMAP_PARTS.map(
  (part) => `  <sitemap>\n    <loc>${escapeXml(`${origin}/sitemap-${part}.xml`)}</loc>\n  </sitemap>`
).join('\n')}
</sitemapindex>
`;

/*
 * An hour, as before.
 *
 * Worth keeping even now the biggest child is 127 KB rather than 2.3 MB,
 * because the cost was never the bytes: every child reads the whole location
 * table to work out its lastmods, and a Worker builds its own responses, so
 * there is no origin fetch for Cloudflare's own cache to sit in front of. The
 * Cache-Control header alone was never doing anything.
 *
 * Safe to cache in a way almost nothing else here is: the same bytes for every
 * visitor, signed in or not, and no user data at all — so the usual hazard,
 * handing one person's page to the next, cannot arise.
 *
 * The fastest thing that changes any of these is an activity retiring, and that
 * job also runs hourly.
 */
export const SITEMAP_CACHE_SECONDS = 3600;

/**
 * The read-through cache every sitemap route shares.
 *
 * `build` is only called on a miss. It may return null to mean "could not
 * build", which becomes a 503 and is deliberately **not** stored: serving a
 * half-built sitemap is worse than serving none, because Google reads a
 * shrunken file as "these pages are gone", and caching one would hand that out
 * for an hour.
 */
export async function cachedXml(
  request: Request,
  locals: unknown,
  build: () => Promise<string | null>
): Promise<Response> {
  /*
   * Cloudflare only. Absent under `astro dev`, which runs on Node, so the whole
   * thing degrades to building the file every time — which is exactly what you
   * want while editing it.
   */
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  if (cache) {
    const hit = await cache.match(request);
    if (hit) return hit;
  }

  const body = await build();
  if (body === null) return new Response('Sitemap temporarily unavailable', { status: 503 });

  const response = new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': `public, max-age=${SITEMAP_CACHE_SECONDS}`,
    },
  });

  /*
   * Stored after the response is on its way, not before it. Nobody waiting for
   * a sitemap should pay for the next requester's copy, and a failed write is
   * not worth failing the request over — the only cost is rebuilding it.
   */
  if (cache) {
    const store = cache.put(request, response.clone()).catch((error) => {
      console.error('Could not cache the sitemap', error);
    });
    /* cfContext, not runtime.ctx — the latter was removed in Astro 6 and now
       throws when touched, which optional chaining does not save you from. */
    const ctx = (locals as { cfContext?: { waitUntil?: (p: Promise<unknown>) => void } }).cfContext;
    if (ctx?.waitUntil) ctx.waitUntil(store);
  }

  return response;
}
