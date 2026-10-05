import type { APIRoute } from 'astro';

import { SITEMAP_CACHE_SECONDS, renderIndex } from '../lib/sitemap';

export const prerender = false;

/*
 * A sitemap index, since 2026-10-05. The children are in sitemap-[part].xml.ts
 * and the split is explained in lib/sitemap.ts.
 *
 * The address does not change, so the sitemap already submitted in Search
 * Console keeps working and Google follows it to the children — but each child
 * is worth submitting separately, because that is what makes the Pages report
 * break coverage down by kind of page.
 *
 * This route touches no data at all. It names the children unconditionally
 * rather than asking which have URLs, which keeps the entry point free and
 * instant; the cost is that if the last public list is ever unpublished,
 * sitemap-lists.xml serves an empty urlset and Search Console files a warning
 * against it. Worth it to keep "are shared lists indexing?" a question with an
 * answer.
 */
export const GET: APIRoute = ({ site, url }) => {
  const origin = (site ?? new URL(url.origin)).origin;

  return new Response(renderIndex(origin), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': `public, max-age=${SITEMAP_CACHE_SECONDS}`,
    },
  });
};
