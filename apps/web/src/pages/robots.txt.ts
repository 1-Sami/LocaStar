import type { APIRoute } from 'astro';

import { PRIVATE_PATHS } from '../lib/site';

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
/* The shared list, plus filtered search — which is public and cacheable but
   is the same content sliced thousands of ways, so it wastes crawl budget. */
const CLOSED = [...PRIVATE_PATHS, '/search?'];

/*
 * The city filter on a category page.
 *
 * Every city chip is a real link a crawler follows, and each one is a Worker
 * invocation and a database read that ends at a canonical pointing back to the
 * unfiltered page — 54 categories times the cities in each, in both languages,
 * all of it spent to be told that the page Google already has is the right one.
 * Search Console files these under "Alternative page with proper canonical
 * tag": working as intended, and still not worth the crawl. That budget is
 * wanted by the place pages sitting in "Discovered — currently not indexed".
 *
 * Deliberately not repeated under /sv/ like the rules above: the leading
 * wildcard matches any path, so /sv/activity/basketball?city=Lund is covered.
 */
const CLOSED_QUERIES = ['/*?city='];

/*
 * Crawlers that cost us the site and send nobody back.
 *
 * The sitemap lists 16,701 addresses — 8,289 places in two languages — and
 * every one is server-rendered, so a full crawl is 16,701 Worker invocations
 * and as many database reads. The free Workers allowance is 100,000 requests a
 * day, and a handful of these bots sweeping the whole map is enough to spend
 * it before any search engine gets a look in. That is what exhausted it on
 * 2026-09-02, with about twenty people using the app.
 *
 * Search engines are not here on purpose. Google, Bing and the rest are the
 * entire reason the site has 16,701 addresses, and they stay welcome. These
 * are the SEO-tooling and AI-training crawlers, which take the same load and
 * return nothing.
 *
 * robots.txt is a request, not a fence — the polite ones honour it, and the
 * rest need Cloudflare's own bot rules. It costs nothing to ask first.
 */
const UNWELCOME = [
  // SEO tooling
  'AhrefsBot',
  'SemrushBot',
  'DotBot',
  'MJ12bot',
  'DataForSeoBot',
  'BLEXBot',
  'PetalBot',
  'SeekportBot',
  'serpstatbot',
  // AI training and scraping
  'GPTBot',
  'CCBot',
  'ClaudeBot',
  'anthropic-ai',
  'Google-Extended',
  'Bytespider',
  'Amazonbot',
  'Applebot-Extended',
  'meta-externalagent',
  'ImagesiftBot',
  'Omgilibot',
];

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

  const rules = [
    ...CLOSED.flatMap((path) => [`Disallow: ${path}`, `Disallow: /sv${path}`]),
    ...CLOSED_QUERIES.map((pattern) => `Disallow: ${pattern}`),
  ];
  const blocked = UNWELCOME.map((agent) => `User-agent: ${agent}\nDisallow: /`).join('\n\n');

  return text(`User-agent: *
Allow: /
${rules.join('\n')}

${blocked}

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
