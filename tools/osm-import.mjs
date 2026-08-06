#!/usr/bin/env node
/**
 * Pulls candidate locations from OpenStreetMap for one category, in one area.
 *
 *   node tools/osm-import.mjs library stockholm
 *   node tools/osm-import.mjs library sweden --out batch.json
 *
 * DRY RUN ALWAYS. This script never touches the database — it prints what it
 * found and, with --out, writes a JSON file. Inserting is a separate, deliberate
 * step, because the point of doing this in stages is to look at the rows before
 * ten thousand of them land in a live table.
 *
 * WHY OSM AND NOT SCRAPING
 * Google Maps forbids scraping in its terms and its data is licensed; building
 * a business on it is a bad foundation. OSM is ODbL: free to use with
 * attribution, which the app already gives (the pin picker renders OSM tiles).
 * It also arrives already geocoded, which skips the step that has produced
 * every coordinate bug in this project so far.
 *
 * ATTRIBUTION IS A LICENCE CONDITION, NOT A COURTESY. Anything imported this
 * way has to carry a visible "© OpenStreetMap contributors" credit somewhere a
 * user can find. Decide where that lives before the first real import.
 */
import { writeFileSync } from 'node:fs';

/**
 * Overpass mirrors, tried in order.
 *
 * The main instance is free, shared, and frequently busy — a 504 from it means
 * "come back later", not "your query is wrong". One mirror being down is the
 * normal case rather than an exception, so failing over is worth more than
 * retrying the same host.
 */
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
];

/**
 * LocaStar category slug -> the OSM tags that mean it.
 *
 * Each entry lists Overpass filters applied to nodes, ways and relations. Keep
 * these narrow: a filter that is too broad imports a thousand rows that are not
 * what the category says, and nobody notices until the map is full of them.
 */
const CATEGORIES = {
  library: { filters: ['["amenity"="library"]'] },
  bowling: { filters: ['["leisure"="bowling_alley"]'] },
  'mini-golf': { filters: ['["leisure"="miniature_golf"]'] },
  'ice-skating': { filters: ['["leisure"="ice_rink"]'] },
  climbing: { filters: ['["sport"="climbing"]'] },
  'nature-reserves': { filters: ['["leisure"="nature_reserve"]'] },
  // Free admission only, which is the whole point of the category. fee=no is
  // the explicit tag; museums with no fee tag at all are left out rather than
  // guessed at, because "we thought it was free" is a bad reason for a wasted trip.
  'museums-free': { filters: ['["tourism"="museum"]["fee"="no"]'] },
  playgrounds: { filters: ['["leisure"="playground"]'] },
  'gyms-outside': { filters: ['["leisure"="fitness_station"]'] },
  'dog-parks': { filters: ['["leisure"="dog_park"]'] },
  skatepark: { filters: ['["leisure"="skatepark"]', '["sport"="skateboard"]'] },
};

/** Bounding boxes as Overpass wants them: south,west,north,east. */
const AREAS = {
  stockholm: { bbox: '59.20,17.75,59.50,18.30', label: 'Stockholm' },
  eskilstuna: { bbox: '59.30,16.40,59.45,16.65', label: 'Eskilstuna' },
  gothenburg: { bbox: '57.60,11.80,57.80,12.10', label: 'Gothenburg' },
  malmo: { bbox: '55.53,12.90,55.65,13.10', label: 'Malmö' },
  sweden: { bbox: '55.00,10.50,69.10,24.20', label: 'Sweden' },
};

function buildQuery(filters, bbox) {
  const parts = filters
    .flatMap((f) => [`node${f}(${bbox});`, `way${f}(${bbox});`, `relation${f}(${bbox});`])
    .join('\n  ');
  // `out center` gives ways and relations a single representative point, which
  // is what a map pin needs — without it they come back as raw geometry.
  return `[out:json][timeout:180];\n(\n  ${parts}\n);\nout center tags;`;
}

/** OSM puts the point on the element for nodes and under `center` for ways/relations. */
function coordsOf(el) {
  if (typeof el.lat === 'number' && typeof el.lon === 'number') return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

/**
 * OSM address tags into the two lines the app stores.
 *
 * Coverage is patchy — plenty of entries have a name and a point and nothing
 * else. A missing address is left null rather than invented; the edit screen
 * can fill it in later, and a wrong address is worse than none.
 */
function addressOf(tags) {
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
  const area = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ');
  const line = [street, area].filter(Boolean).join(', ');
  return {
    address: line || null,
    city: tags['addr:city'] ?? null,
  };
}

function toRow(el, categorySlug, batch) {
  const tags = el.tags ?? {};
  const point = coordsOf(el);
  if (!point || !tags.name) return null; // Unnamed or unplaceable is not a location.
  const { address, city } = addressOf(tags);
  return {
    osm: `${el.type}/${el.id}`,
    name: tags.name,
    categorySlug,
    lat: point.lat,
    lng: point.lng,
    address,
    city,
    country: 'Sweden',
    website: tags.website ?? tags['contact:website'] ?? null,
    phone: tags.phone ?? tags['contact:phone'] ?? null,
    importBatch: batch,
  };
}

async function queryOverpass(query) {
  const failures = [];
  for (const url of OVERPASS_MIRRORS) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // Overpass answers 406 without one. It is a shared free service and
          // asks that clients identify themselves, so an abusive client can be
          // contacted rather than the whole user agent blocked.
          'User-Agent': 'LocaStar location import (support@locastar.se)',
        },
        body: new URLSearchParams({ data: query }),
      });
      if (response.ok) return response.json();
      failures.push(`${new URL(url).host} -> ${response.status}`);
    } catch (error) {
      failures.push(`${new URL(url).host} -> ${error.message}`);
    }
  }
  throw new Error(
    `Every Overpass mirror refused:\n  ${failures.join('\n  ')}\n` +
      'These are free shared servers; 429 and 504 mean busy, not broken. Try again shortly.'
  );
}

async function main() {
  const [slug, areaKey, ...rest] = process.argv.slice(2);
  const outIndex = rest.indexOf('--out');
  const outFile = outIndex >= 0 ? rest[outIndex + 1] : null;

  if (!CATEGORIES[slug] || !AREAS[areaKey]) {
    console.error('Usage: node tools/osm-import.mjs <category> <area> [--out file.json]\n');
    console.error('  categories:', Object.keys(CATEGORIES).join(', '));
    console.error('  areas     :', Object.keys(AREAS).join(', '));
    process.exit(1);
  }

  const area = AREAS[areaKey];
  const batch = `osm-${areaKey}-${slug}-${new Date().toISOString().slice(0, 10)}`;
  const query = buildQuery(CATEGORIES[slug].filters, area.bbox);

  console.log(`Overpass: ${slug} in ${area.label}`);
  const started = Date.now();
  const payload = await queryOverpass(query);
  const elements = payload.elements ?? [];

  const rows = elements.map((el) => toRow(el, slug, batch)).filter(Boolean);
  const skipped = elements.length - rows.length;
  const withAddress = rows.filter((r) => r.address).length;

  console.log(`  ${elements.length} elements in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`  ${rows.length} usable (named, with a point) — ${skipped} skipped`);
  console.log(`  ${withAddress} of ${rows.length} have an address`);
  console.log(`  batch id: ${batch}\n`);

  for (const row of rows.slice(0, 15)) {
    console.log(
      `  ${row.name.slice(0, 38).padEnd(40)} ${row.lat.toFixed(4)},${row.lng.toFixed(4)}  ${row.address ?? '(no address)'}`
    );
  }
  if (rows.length > 15) console.log(`  … and ${rows.length - 15} more`);

  if (outFile) {
    writeFileSync(outFile, JSON.stringify({ batch, categorySlug: slug, rows }, null, 2));
    console.log(`\nWrote ${rows.length} rows to ${outFile}. Nothing has been inserted.`);
  } else {
    console.log('\nDry run — nothing written. Pass --out <file> to save the rows.');
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
