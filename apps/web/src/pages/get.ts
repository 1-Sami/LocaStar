import type { APIRoute } from 'astro';

import { STORE_LINKS, appStoreReady, googlePlayReady } from '../lib/site';

export const prerender = false;

/*
 * The address behind every QR code on the site, and the only one that can be.
 *
 * A scan happens on a phone we know nothing about until it arrives, so the
 * store is chosen here from the request rather than baked into the picture.
 * That also means the code on a poster keeps working the day Google Play goes
 * live: one line in site.ts, no reprint.
 *
 * Anything that is not a phone — or a phone whose store we cannot serve yet —
 * lands on the home page's download band, which shows both badges and says out
 * loud where each one stands. Never a 404, and never the wrong store.
 */
const IOS = /iPhone|iPad|iPod/i;
const ANDROID = /Android/i;

export const GET: APIRoute = ({ request, locals }) => {
  const ua = request.headers.get('user-agent') ?? '';
  const lang = locals.lang ?? 'en';
  const band = lang === 'sv' ? '/sv/#get-the-app' : '/#get-the-app';

  let target = band;
  if (IOS.test(ua) && appStoreReady) target = STORE_LINKS.appStore;
  else if (ANDROID.test(ua) && googlePlayReady) target = STORE_LINKS.googlePlay;

  /*
   * 302 and no-store, deliberately. The answer depends on the device asking
   * and on which stores are live — a 301 would be cached in the browser of
   * every Android visitor who scanned before Play existed, and they would
   * never see the redirect change.
   */
  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      'Cache-Control': 'no-store',
      Vary: 'User-Agent',
    },
  });
};
