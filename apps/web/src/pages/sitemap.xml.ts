import { fetchSitemapEntries } from '@locastar/shared';
import type { APIRoute } from 'astro';

import { anonClient } from '../lib/supabase';

export const prerender = false;

/*
 * Generated per request, not at build time.
 *
 * An activity that has ended is retired by an hourly job, and a place a
 * moderator removes stops being readable immediately. Both must drop out of the
 * sitemap, and a file baked at deploy time would keep offering them until
 * somebody redeployed — pointing Google at pages that now 404.
 *
 * Because the query runs as `anon`, RLS does that filtering for us: whatever
 * comes back is exactly what a stranger can open.
 */

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

const escapeXml = (value: string) =>
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

export const GET: APIRoute = async ({ site, url }) => {
  const origin = (site ?? new URL(url.origin)).origin;
  const supabase = anonClient();

  let entries;
  try {
    entries = await fetchSitemapEntries(supabase);
  } catch (error) {
    /*
     * Serving a half-built sitemap is worse than serving none: Google treats a
     * shrunken file as "these pages are gone". Fail loudly instead.
     */
    console.error('Failed to build the sitemap', error);
    return new Response('Sitemap temporarily unavailable', { status: 503 });
  }

  const english = [
    ...STATIC_PATHS.map((path) => ({ path, lastmod: null as string | null })),
    ...entries.categories,
    ...entries.locations,
    ...entries.lists,
  ];

  /*
   * Both languages, each as its own URL.
   *
   * Google indexes addresses. The hreflang tags on the pages say these are the
   * same page in two languages rather than duplicates, but the Swedish ones
   * still have to be listed or nothing crawls them.
   */
  const urls = [
    ...english,
    ...english
      .filter(({ path }) => !ENGLISH_ONLY.includes(path))
      .map(({ path, lastmod }) => ({ path: path === '/' ? '/sv/' : `/sv${path}`, lastmod })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(({ path, lastmod }) => {
    const loc = `  <url>\n    <loc>${escapeXml(origin + path)}</loc>`;
    const mod = lastmod ? `\n    <lastmod>${escapeXml(new Date(lastmod).toISOString().slice(0, 10))}</lastmod>` : '';
    return `${loc}${mod}\n  </url>`;
  })
  .join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // An hour is plenty: an activity retiring is the fastest thing that
      // changes this file, and that job runs hourly too.
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
