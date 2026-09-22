import { fetchNearbyLocationsBrief } from '@locastar/shared';
import type { APIRoute } from 'astro';

import { currentUser } from '../../lib/auth';
import { lookupAddress, lookupCoordinates } from '../../lib/geocode';

/*
 * "Check location" on the add form: where would this pin go, and is something
 * already there?
 *
 * Signed-in only, because every lookup here is a request to Nominatim, which is
 * donated infrastructure with a hard ceiling — an open endpoint would let anyone
 * spend our allowance, and get the site's user agent blocked for everyone. Only
 * a person adding a place has a reason to ask.
 *
 * The duplicate check matches the app's: the same category, within 200 m, five
 * at most. Nothing stops two people adding the same court, which would split
 * its reviews between two listings; showing what is already there lets the
 * person decide, which is the most that can be done without a map.
 */
export const prerender = false;

const DUPLICATE_RADIUS_M = 200;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const GET: APIRoute = async ({ request, cookies, url }) => {
  const { user, supabase } = await currentUser(cookies, request.headers);
  if (!user) return json({ ok: false, error: 'signed-out' }, 401);

  const mode = url.searchParams.get('mode') === 'coords' ? 'coords' : 'address';
  const street = url.searchParams.get('street')?.trim() ?? '';
  const area = url.searchParams.get('area')?.trim() ?? '';
  const coords = url.searchParams.get('coords')?.trim() ?? '';
  const category = url.searchParams.get('category')?.trim() || null;

  if (mode === 'address' ? !street || !area : !coords) return json({ ok: false, error: 'empty' }, 400);

  const lookup = mode === 'address' ? await lookupAddress(street, area) : await lookupCoordinates(coords);
  if (!lookup.ok) return json(lookup);

  const { pin } = lookup;
  const nearby = category
    ? await fetchNearbyLocationsBrief(supabase, {
        lat: pin.lat,
        lng: pin.lng,
        radiusM: DUPLICATE_RADIUS_M,
        categorySlugs: [category],
        maxResults: 5,
      }).catch(() => [])
    : [];

  return json({
    ok: true,
    pin,
    nearby: nearby.map((place) => ({ id: place.id, name: place.name, distance: Math.round(place.distance_m) })),
  });
};
