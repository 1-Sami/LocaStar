/*
 * Turning a typed address, or typed coordinates, into a pin — with no map.
 *
 * The website cannot show a map without paying for tiles (see LeafletMap.astro),
 * but it does not need one to place a pin. An address goes to Nominatim,
 * OpenStreetMap's own address service, the same source the imported places came
 * from; coordinates are the pin already, and Nominatim only fills in the street
 * and town around them.
 *
 * Nominatim is donated infrastructure with a usage policy, and this stays inside
 * it: one lookup when somebody asks for one — never as-you-type, which the
 * policy forbids — from the server rather than every visitor's browser, under a
 * user agent that names us, cached so the same address is not asked twice, and
 * only for signed-in people who are adding something. Adding a place happens a
 * handful of times a day; the ceiling is one request a second.
 *
 * Attribution is the footer's "Place data © OpenStreetMap contributors", which
 * is on every page including this one.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'LocaStar/1.0 (+https://locastar.se; support@locastar.se)';

/*
 * Sweden only, for now. A bare "Storgatan 1" exists in nearly every Swedish town
 * and half of Europe, and every place on LocaStar today is Swedish, so leaving
 * the country open would mostly buy wrong answers. One constant to widen, and
 * the box below with it, when the map does.
 */
const COUNTRY_CODES = 'se';
const SWEDEN = { minLat: 55.0, maxLat: 69.2, minLng: 10.5, maxLng: 24.3 };

/*
 * Street level or finer. Nominatim will happily answer "Nosuchstreet 9, Botkyrka"
 * with the centre of Botkyrka, and saving that would put a court in the middle
 * of a municipality with nothing to say it is a guess. 26 is a street, 30 a
 * house or a named thing; a town is about 16. A square is 25 but is as exact as
 * a street — "Stortorget 1, Malmö" answers with the square first.
 */
const MIN_ADDRESS_RANK = 26;
const isPrecise = (hit: NominatimPlace) =>
  (hit.place_rank ?? 0) >= MIN_ADDRESS_RANK || (hit.category === 'place' && hit.type === 'square');

export interface PinResult {
  lat: number;
  lng: number;
  /** "Kanaans väg 12" — what an envelope's first line would say. */
  street: string | null;
  /** "145 69 Botkyrka" — the second line. */
  area: string | null;
  /** The town, by the same rule the importer uses, so town pages stay whole. */
  city: string | null;
  /** In English, as every existing row has it: "Sweden". */
  country: string | null;
}

export type LookupError = 'not-found' | 'imprecise' | 'bad-coords' | 'outside' | 'swapped' | 'failed';

export type Lookup = { ok: true; pin: PinResult } | { ok: false; error: LookupError; suggestion?: string };

type NominatimAddress = Record<string, string | undefined>;
type NominatimPlace = {
  lat: string;
  lon: string;
  place_rank?: number;
  category?: string;
  type?: string;
  address?: NominatimAddress;
};

/*
 * Municipalities whose own names end in s — see townFromNominatim. Copied from
 * tools/osm-import.mjs, which is where the rule was worked out against 2,179
 * wrong town names; keep the two in step.
 */
const MUNICIPALITIES_ENDING_IN_S = new Set([
  'Alingsås', 'Bengtsfors', 'Bollnäs', 'Borås', 'Degerfors', 'Grums', 'Hagfors',
  'Hällefors', 'Hofors', 'Höganäs', 'Kramfors', 'Munkfors', 'Mönsterås',
  'Robertsfors', 'Sotenäs', 'Storfors', 'Strängnäs', 'Torsås', 'Tranås',
  'Vännäs', 'Västerås',
]);

/*
 * The town to store, from a Nominatim address.
 *
 * The same rule as the importer's (tools/osm-import.mjs), because the town is
 * what the per-town pages group by: a place added here as "Linköpings" would be
 * the only one on its own page, beside 127 in "Linköping". Nominatim falls back
 * to the municipality, and Swedish municipality names are genitive
 * ("Linköpings kommun") — stripping "kommun" is not enough, the s has to go too,
 * except where it is the name's own. Registration districts ("Alnö distrikt")
 * become the area's name.
 */
function townFromAddress(a: NominatimAddress): string | null {
  const raw = a.city ?? a.town ?? a.municipality ?? '';
  const ownS = (name: string) => MUNICIPALITIES_ENDING_IN_S.has(name) || /näs$/.test(name);
  const ungenitive = (name: string) => (name.endsWith('s') && !ownS(name) ? name.slice(0, -1) : name);

  const district = raw.match(/^(.*?)\s*(?:(?:domkyrko)?distrikt|kommundel)$/i);
  if (district) {
    let area = district[1].trim();
    const first = area.split(' ')[0];
    if (area.includes(' ') && first.endsWith('s')) area = first;
    return ungenitive(area) || null;
  }

  const bare = raw.replace(/\s+kommun$/i, '');
  if (bare === raw) return raw || null;
  return ungenitive(bare) || null;
}

const REGION_NAMES = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();

function countryName(a: NominatimAddress): string | null {
  const code = a.country_code?.toUpperCase();
  if (code) {
    const name = REGION_NAMES?.of(code);
    if (name) return name;
    if (code === 'SE') return 'Sweden';
  }
  return a.country ?? null;
}

const roadOf = (a: NominatimAddress) => a.road ?? a.pedestrian ?? a.square ?? a.footway ?? a.path ?? null;

function toPin(lat: number, lng: number, a: NominatimAddress | undefined): PinResult {
  const address = a ?? {};
  const road = roadOf(address);
  const street = road ? [road, address.house_number].filter(Boolean).join(' ') : null;
  // A pin out in the forest has only a municipality, and "Kiruna kommun" is not
  // how anyone writes the second line of an address.
  const town = address.city ?? address.town ?? address.village ?? address.suburb ?? townFromAddress(address);
  const area = [address.postcode, town].filter(Boolean).join(' ') || null;
  return { lat, lng, street, area, city: townFromAddress(address), country: countryName(address) };
}

/*
 * One request to Nominatim, through the Worker's cache.
 *
 * A day is plenty: an address does not move, and the point is that somebody
 * pressing "Check" and then "Submit" asks once. Absent under `astro dev`, where
 * this simply asks every time.
 */
async function ask<T>(url: string): Promise<T | null> {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const key = new Request(url);
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return (await hit.json()) as T;
  }

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'sv' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const body = await res.text();

  if (cache) {
    await cache
      .put(key, new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' } }))
      .catch(() => {});
  }
  return JSON.parse(body) as T;
}

const inSweden = (lat: number, lng: number) =>
  lat >= SWEDEN.minLat && lat <= SWEDEN.maxLat && lng >= SWEDEN.minLng && lng <= SWEDEN.maxLng;

/**
 * Coordinates as people actually write them, or null.
 *
 * "59.32932, 18.06858" is what Google Maps copies; "59,32932 18,06858" is how a
 * Swedish keyboard writes decimals; "59.32932 18.06858" drops the comma. All
 * three are the same two numbers, so all three are accepted: the numbers are
 * pulled out and a comma inside one is read as its decimal point.
 */
export function parseCoordinates(text: string): { lat: number; lng: number } | null {
  const numbers = text.match(/-?\d+(?:[.,]\d+)?/g);
  if (!numbers || numbers.length !== 2) return null;
  const [lat, lng] = numbers.map((n) => Number(n.replace(',', '.')));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** "Kungsgatan 12 B" → "kungsgatan": the street's name without its number. */
const streetName = (text: string) =>
  text
    .toLowerCase()
    .replace(/\s+\d.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();

/** An address — street line and postcode-and-town line — to a pin. */
export async function lookupAddress(street: string, area: string): Promise<Lookup> {
  const q = `${street.trim()}, ${area.trim()}`;
  const url = `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=${COUNTRY_CODES}&q=${encodeURIComponent(q)}`;
  let results: NominatimPlace[] | null;
  try {
    results = await ask<NominatimPlace[]>(url);
  } catch (error) {
    console.error('Address lookup failed', error);
    return { ok: false, error: 'failed' };
  }
  if (!results?.length) return { ok: false, error: 'not-found' };
  const precise = results.filter(isPrecise);
  if (precise.length === 0) return { ok: false, error: 'imprecise' };

  /*
   * Nominatim ranks a house on a similarly named street above the street that
   * was actually typed: "Kungsgatan 2, Göteborg" comes back as Lilla Kungsgatan
   * 2 first, with Kungsgatan itself third. Five answers, and the one on the
   * street the person named wins; failing that, Nominatim's own first choice,
   * which the "Check location" preview shows them before anything is saved.
   */
  const typed = streetName(street);
  const hit = precise.find((h) => streetName(roadOf(h.address ?? {}) ?? '') === typed) ?? precise[0];
  return { ok: true, pin: toPin(Number(hit.lat), Number(hit.lon), hit.address) };
}

/** Typed coordinates to a pin, with the street and town around them. */
export async function lookupCoordinates(text: string): Promise<Lookup> {
  const coords = parseCoordinates(text);
  if (!coords) return { ok: false, error: 'bad-coords' };

  /*
   * The commonest mistake with coordinates is writing them the wrong way round,
   * which puts a Stockholm court in the Gulf of Aden. Said out loud rather than
   * silently swapped, because a quiet correction that happens to be wrong is
   * worse than a question.
   */
  if (!inSweden(coords.lat, coords.lng)) {
    if (inSweden(coords.lng, coords.lat)) {
      return { ok: false, error: 'swapped', suggestion: `${coords.lng}, ${coords.lat}` };
    }
    return { ok: false, error: 'outside' };
  }

  const url = `${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${coords.lat}&lon=${coords.lng}`;
  try {
    const place = await ask<NominatimPlace & { error?: string }>(url);
    // The pin is what they typed, whatever the address says; the lookup only
    // names the street around it. A spot in the forest may have no street.
    return { ok: true, pin: toPin(coords.lat, coords.lng, place?.error ? undefined : place?.address) };
  } catch (error) {
    console.error('Reverse lookup failed', error);
    // Still a usable pin — only the street name is missing.
    return { ok: true, pin: { lat: coords.lat, lng: coords.lng, street: null, area: null, city: null, country: 'Sweden' } };
  }
}
