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

  const gone = retiredRoute(pathname);
  if (gone) return context.redirect(gone, 301);

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
 * Routes the old site had and this one does not.
 *
 * locastar.se used to serve the Expo web export, where the whole app ran in
 * the browser — so /profile, /favorites, /lists and /settings were real pages.
 * This site deliberately does not reimplement the app; that material lives in
 * one place, /account, under its four sections.
 *
 * Without these, every one of those addresses becomes a 404 the moment the
 * domain moves. They are 301s because the old routes are not coming back, and
 * a permanent redirect is what retires a URL cleanly rather than leaving it in
 * the index as a dead end.
 *
 * Both languages, because the switch is in the header of every page and there
 * is no reason a Swedish visitor should land in English for following a stale
 * link.
 */
const RETIRED: Record<string, string> = {
  '/profile': '/account',
  '/favorites': '/account?show=saved',
  '/lists': '/account?show=lists',
  '/settings': '/account',
  // No language page here — the EN · SV switch sits in the header of every
  // page, so the home page is where that intention is already satisfied.
  '/settings/language': '/',
};

function retiredRoute(pathname: string): string | null {
  const sv = pathname === '/sv' || pathname.startsWith('/sv/');
  const bare = sv ? pathname.slice(3) || '/' : pathname;

  /*
   * Trailing slash stripped first: the old site answered /lists with a 307 to
   * /lists/, so both spellings are in circulation and both have to land.
   */
  const key = bare.length > 1 && bare.endsWith('/') ? bare.slice(0, -1) : bare;

  /*
   * Only the bare route. /lists/<id> is a live page on this site — a public
   * list's share link — and redirecting that to the account area would break
   * the one URL the app has been handing out.
   */
  const target = RETIRED[key];
  if (!target) return null;

  return sv ? (target === '/' ? '/sv/' : `/sv${target}`) : target;
}

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
