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
 *
 * Every rule is repeated under /sv/, because the Swedish half of the site is a
 * separate set of addresses and a rule that names /account does not cover
 * /sv/account.
 */
const CLOSED = ['/account', '/auth', '/add', '/admin', '/search?'];

export const GET: APIRoute = ({ site, url }) => {
  const canonicalHost = new URL(site ?? url.origin).host;
  const origin = (site ?? new URL(url.origin)).origin;

  /*
   * A preview deployment is not the site.
   *
   * The workers.dev address serves the same pages, so left open it is a second
   * copy of everything competing with the real one. Canonicals point home, but
   * there is no reason for the preview to be crawled at all.
   */
  if (url.host !== canonicalHost) {
    return text('User-agent: *\nDisallow: /\n');
  }

  const rules = CLOSED.flatMap((path) => [`Disallow: ${path}`, `Disallow: /sv${path}`]);

  return text(`User-agent: *
Allow: /
${rules.join('\n')}

Sitemap: ${origin}/sitemap.xml
`);
};

const text = (body: string) =>
  new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
