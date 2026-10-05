import { fetchSitemapEntries } from '@locastar/shared';
import type { APIRoute } from 'astro';

import { cachedXml, isSitemapPart, partUrls, renderUrlset } from '../lib/sitemap';
import { anonClient } from '../lib/supabase';

export const prerender = false;

/*
 * One child of the sitemap index. Which URLs belong to which part is in
 * lib/sitemap.ts, so the index and the children cannot name different things.
 *
 * Built per request, not at build time. An activity that has ended is retired
 * by an hourly job, and a place a moderator removes stops being readable
 * immediately; both must drop out, and a file baked at deploy time would keep
 * offering them until somebody redeployed — pointing Google at pages that now
 * 404. Because the query runs as `anon`, RLS does that filtering for us:
 * whatever comes back is exactly what a stranger can open.
 *
 * Every child reads the whole location table, even the ones listing a handful
 * of URLs, because the category and town lastmods are the newest place on each
 * page and that is only knowable from all of them. Hence the hour's cache in
 * cachedXml — the cost is the read, not the bytes.
 */
export const GET: APIRoute = async ({ params, site, url, request, locals }) => {
  const part = params.part;
  // An unknown part is a page that does not exist, not an empty sitemap. An
  // empty urlset would tell Google these pages are gone.
  if (!part || !isSitemapPart(part)) return new Response(null, { status: 404 });

  const origin = (site ?? new URL(url.origin)).origin;

  return cachedXml(request, locals, async () => {
    try {
      const entries = await fetchSitemapEntries(anonClient());
      return renderUrlset(origin, partUrls(part, entries));
    } catch (error) {
      console.error(`Failed to build sitemap-${part}.xml`, error);
      return null;
    }
  });
};
