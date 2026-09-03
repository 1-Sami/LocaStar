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

/*
 * The one page on this site worth the Worker keeping a copy of.
 *
 * It is 16,701 addresses read out of the database and 2.2 MB of XML, and it
 * took 6.5 seconds to answer. Search engines ask for it repeatedly, and every
 * one of them paid that in full, because a Worker builds its own responses —
 * there is no origin fetch for Cloudflare's own cache to sit in front of, so
 * the Cache-Control below was never doing anything.
 *
 * Safe to cache in a way almost nothing else here is: it is the same bytes for
 * every visitor, signed in or not, and contains no user data at all — so the
 * usual hazard, handing one person's page to the next, cannot arise.
 *
 * An hour, matching what the header already claimed. The fastest thing that
 * changes this file is an activity retiring, and that job also runs hourly.
 */
const CACHE_SECONDS = 3600;

export const GET: APIRoute = async ({ site, url, request, locals }) => {
  const origin = (site ?? new URL(url.origin)).origin;

  /*
   * Cloudflare only. Absent under `astro dev`, which runs on Node, so the
   * whole thing degrades to building the file every time — which is exactly
   * what you want while editing it.
   */
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  if (cache) {
    const hit = await cache.match(request);
    if (hit) return hit;
  }

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

  const response = new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
    },
  });

  /*
   * Stored after the response is on its way, not before it. Writing 2.2 MB is
   * not free, and nobody waiting for a sitemap should pay for the next
   * requester's copy. A failed write is not worth failing the request over —
   * the only cost is rebuilding it next time.
   *
   * The 503 above returns before reaching here on purpose: a sitemap that
   * failed to build must never be the copy handed out for an hour.
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
};
