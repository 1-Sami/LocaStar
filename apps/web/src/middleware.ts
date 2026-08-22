import { defineMiddleware } from 'astro:middleware';

/*
 * Swedish lives under /sv/, English stays where it is.
 *
 * Agreed with the owner. Google indexes addresses, not language variants behind
 * one address — a cookie or an Accept-Language switch would mean one URL and
 * therefore one indexed language, which defeats the point of translating a site
 * whose whole purpose is Swedish search traffic.
 *
 * /sv/search is rewritten onto the same page file as /search rather than
 * duplicating every route into a src/pages/sv/ tree. One file, two languages,
 * no chance of the two drifting apart.
 *
 * Nothing in English moves. /location/<id> and /legal/privacy are frozen URLs
 * that Apple, Google and every share link already point at.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  let response: Response;

  if (pathname === '/sv' || pathname.startsWith('/sv/')) {
    context.locals.lang = 'sv';
    const rest = pathname === '/sv' ? '/' : pathname.slice(3);
    /*
     * next(path) rather than rewrite(path): rewrite re-enters this middleware
     * on the new path, which no longer starts with /sv, so the language was
     * reset to English before the page ever rendered. next() rewrites without
     * running the chain again, so locals.lang survives.
     */
    response = await next(rest + context.url.search);
  } else {
    context.locals.lang = 'en';
    response = await next();
  }

  applyHeaders(context.url, context.request, response);
  return response;
});

/*
 * Headers for rendered pages.
 *
 * public/_headers cannot do this job: Cloudflare applies that file to static
 * assets, and every page here is rendered by the Worker. So the whole site was
 * being served with no cache policy and no security headers at all.
 */
function applyHeaders(url: URL, request: Request, response: Response) {
  const headers = response.headers;
  if (!headers.get('content-type')?.includes('text/html')) return;

  /*
   * Only locastar.se is the site. The workers.dev preview serves the same
   * pages, and robots.txt asking nicely is weaker than the header saying so.
   */
  if (url.host !== new URL(import.meta.env.SITE ?? url.origin).host) {
    headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // The account area has a delete-account flow; nothing here belongs in a frame.
  headers.set('Content-Security-Policy', "frame-ancestors 'none'");

  /*
   * Cached at the edge, but only for a stranger.
   *
   * A signed-in page carries somebody's name and their saved places, and a
   * shared cache holding that would hand one person's account to the next
   * visitor. The cookie is the tell, and it also has to go in Vary so a cached
   * anonymous copy is never served to a request that has one.
   */
  const signedIn = (request.headers.get('cookie') ?? '').includes('sb-');
  const private_ = signedIn || PRIVATE.some((prefix) => stripLocale(url.pathname).startsWith(prefix));

  if (private_) {
    headers.set('Cache-Control', 'private, no-store');
  } else {
    headers.set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');
  }
  headers.append('Vary', 'Cookie');
}

/** Never cached, signed in or not. */
const PRIVATE = ['/account', '/auth', '/api', '/report'];

const stripLocale = (pathname: string) =>
  pathname === '/sv' ? '/' : pathname.startsWith('/sv/') ? pathname.slice(3) : pathname;
