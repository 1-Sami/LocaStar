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
  appStore: '',
  googlePlay: '',
} as const;

export const storeLinksReady = Boolean(STORE_LINKS.appStore && STORE_LINKS.googlePlay);

/**
 * OpenStreetMap attribution.
 *
 * A licence requirement, not decoration: most of the map was imported from
 * OpenStreetMap, and ODbL requires the attribution to travel with the data.
 * It belongs on every page that shows imported places.
 */
export const OSM_ATTRIBUTION = {
  text: 'Place data partly from OpenStreetMap contributors, under ODbL.',
  href: 'https://www.openstreetmap.org/copyright',
} as const;

export const SUPPORT_EMAIL = 'support@locastar.se';
