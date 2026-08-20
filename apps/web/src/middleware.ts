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

  if (pathname === '/sv' || pathname.startsWith('/sv/')) {
    context.locals.lang = 'sv';
    const rest = pathname === '/sv' ? '/' : pathname.slice(3);
    /*
     * next(path) rather than rewrite(path): rewrite re-enters this middleware
     * on the new path, which no longer starts with /sv, so the language was
     * reset to English before the page ever rendered. next() rewrites without
     * running the chain again, so locals.lang survives.
     */
    return next(rest + context.url.search);
  }

  context.locals.lang = 'en';
  return next();
});
