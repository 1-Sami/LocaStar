import type { APIRoute } from 'astro';

export const prerender = false;

/*
 * Disallow rules are about crawl budget, not secrecy — anything genuinely
 * private is protected by RLS, not by asking politely.
 *
 * /account and /auth have nothing to index and would waste crawls on pages
 * that redirect to a sign-in. Filtered search URLs are excluded for the same
 * reason the category page canonicalises them away: they are the same content
 * sliced, and thousands of them competing dilutes the pages that should win.
 */
export const GET: APIRoute = ({ site, url }) => {
  const origin = (site ?? new URL(url.origin)).origin;

  const body = `User-agent: *
Allow: /
Disallow: /account
Disallow: /auth
Disallow: /add
Disallow: /search?

Sitemap: ${origin}/sitemap.xml
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
