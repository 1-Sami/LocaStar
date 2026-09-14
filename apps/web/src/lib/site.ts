/*
 * Facts about the product that the pages state out loud.
 *
 * Kept in one place because several of them are claims — and a claim that goes
 * stale on a public page is worse than no claim.
 */

/**
 * Store links.
 *
 * Empty until the apps are actually live. The App Store id does not exist until
 * Apple approves, and a "Download on the App Store" button that 404s is worse
 * than saying the app is on its way — it reads as a broken product to the first
 * person who ever sees the site.
 *
 * The pages check these: empty means the badges are replaced by an honest line.
 * Fill both in the day the apps are public.
 */
export const STORE_LINKS = {
  /* Live 2026-09-02. No country segment on purpose — Apple sends each visitor
     to their own storefront, and the Swedish one resolves to the localised
     name, which is the listing Swedish search will find. */
  appStore: 'https://apps.apple.com/app/locastar/id6800435437',
  /* Filling this in also hides the home page's "Android app not yet released"
     note. Delete that note (home.androidNotYet) in the same change. */
  googlePlay: '',
} as const;

/*
 * Judged per store, not once for both.
 *
 * They were a single flag while neither was public. iOS went live on
 * 2026-09-02 while Android is still in a closed test, so one flag would have
 * meant either holding back a link that works or shipping one that 404s.
 */
/* Judged per store; there is no longer a combined flag, because the two
   stores went live months apart. */
export const appStoreReady = Boolean(STORE_LINKS.appStore);
export const googlePlayReady = Boolean(STORE_LINKS.googlePlay);

/**
 * OpenStreetMap attribution.
 *
 * A licence requirement, not decoration: most of the map was imported from
 * OpenStreetMap, and ODbL requires the attribution to travel with the data.
 * It belongs on every page that shows imported places.
 */
/*
 * Paths with nothing to index and nothing a shared cache should ever hold.
 *
 * One list because there were two, and they had drifted: the middleware knew
 * about /api and /report, robots.txt knew about /add and /admin, and neither
 * knew the other's. Anything named here is served no-store and noindex, and
 * robots.txt asks crawlers not to come at all.
 */
export const PRIVATE_PATHS = ['/account', '/auth', '/api', '/report', '/add', '/admin'] as const;

export const OSM_ATTRIBUTION = {
  text: 'Place data partly from OpenStreetMap contributors, under ODbL.',
  href: 'https://www.openstreetmap.org/copyright',
} as const;

export const SUPPORT_EMAIL = 'support@locastar.se';
