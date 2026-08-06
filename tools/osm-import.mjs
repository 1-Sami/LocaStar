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
];

/*
 * overpass.osm.ch was in this list and had to come out. It is a REGIONAL
 * instance holding Swiss data only, so a Sweden query returns HTTP 200 with
 * zero elements — indistinguishable from a successful empty search. Failing
 * over to it turned a busy main server into a silent, confident "there are no
 * basketball courts in Stockholm", and the empty-result guard then blamed a
 * busy mirror, which was the wrong diagnosis.
 *
 * Verified before removing: the same query returns 0 for a Stockholm bbox and
 * 48 for a Zurich one. Any mirror added here must be a full planet instance.
 */

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
  'gyms-outside': { filters: ['["leisure"="fitness_station"]', '["leisure"="fitness_centre"]["outdoor"="yes"]'] },
  // Pitches carry the sport on the pitch itself. Both spellings of football
  // exist in OSM: soccer is the tag, football is sometimes used loosely, so
  // this stays on soccer to avoid dragging in American football and rugby.
  basketball: { filters: ['["sport"="basketball"]'] },
  football: { filters: ['["sport"="soccer"]'] },
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
  // `out geom` rather than `out center`. Overpass's "center" is the middle of
  // the bounding box, which it documents as possibly falling outside the object
  // — for an L-shaped building or a pitch on an odd plot, the pin lands off the
  // thing it is supposed to mark. With the real vertex list we can compute a
  // proper centroid instead.
  return `[out:json][timeout:180];\n(\n  ${parts}\n);\nout geom tags;`;
}

/**
 * How close two rows with the same derived name must be to be treated as one.
 *
 * 30 m, down from 100. These names are derived from the street, not the place —
 * two genuinely separate courts on the same long road would otherwise collapse
 * into one and the second would silently disappear. At 100 m the Stockholm run
 * merged two courts on Edsbergs torg that were 74 m apart and had unrelated OSM
 * ids, which looked like two real courts in one square rather than one facility
 * mapped twice.
 *
 * 30 m still catches the real case this exists for: one mapper drawing two
 * halves of a double court in a single session, which shows up as consecutive
 * OSM ids a few metres apart.
 */
const MERGE_RADIUS_M = 30;

/** Metres between two points. Haversine, mean Earth radius. */
function metresBetween(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Drops rows that duplicate another row *in the same batch*.
 *
 * OSM frequently holds the same place twice — once as a node and once as the
 * building way — a few metres apart. Stockholm's libraries contain exactly
 * that: two "Vällingby bibliotek" at the same coordinates to five decimals.
 *
 * The SQL has a not-exists guard, but it cannot catch these: the whole insert
 * is one statement, so every row's subquery sees the table as it was before any
 * of them landed. They have to be removed here instead.
 *
 * Keeps the first of each pair, which is the one with more tags filled in
 * often enough not to matter — a moderator can merge what slips through.
 */
function dedupe(rows) {
  // Nodes first, so when the same place exists as both a point and a building
  // outline the point wins. A node was placed by hand, usually at the door; a
  // computed polygon centre is the middle of the roof at best.
  const ordered = [...rows].sort((a, b) => {
    const rank = (r) => (r.osm.startsWith('node/') ? 0 : 1);
    return rank(a) - rank(b);
  });

  const kept = [];
  const dropped = [];
  for (const row of ordered) {
    const twin = kept.find((k) => k.name === row.name && metresBetween(k, row) < MERGE_RADIUS_M);
    // Record what it merged into and how far apart they were. A merge silently
    // removes a real place from the map if the guess is wrong, so it has to be
    // checkable rather than just counted.
    if (twin) dropped.push({ row, into: twin, metres: metresBetween(twin, row) });
    else kept.push(row);
  }
  return { kept, dropped };
}

/** A SQL string literal, or a typed NULL. Names contain apostrophes — S:t Erik. */
function sqlText(value) {
  if (value === null || value === undefined || value === '') return 'null::text';
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * The INSERT, as SQL rather than a database connection.
 *
 * Deliberately not a script that talks to Supabase directly: doing that needs
 * the service_role key, which bypasses RLS entirely and would have to be handed
 * around to get there. Emitting SQL means the credential never leaves the
 * dashboard, and — more usefully — the exact statement can be read before it
 * runs. A bulk insert into a live table is worth reading first.
 *
 * Two guards are built in:
 *
 *   - the whole thing is one transaction, so a failure half way leaves nothing
 *     behind;
 *   - each row is skipped if a location of the same name already exists within
 *     100 m. That makes the file safe to run twice, and stops an import
 *     stamping a duplicate on top of somewhere a real person already added.
 *
 * created_by is looked up by username rather than pasted as a uuid, so the file
 * says who owns these rows in a form you can check.
 */
function buildSql(rows, categorySlug, batch, ownerUsername) {
  const values = rows
    .map(
      (r) =>
        `    (${sqlText(r.name)}, ${sqlText(r.address)}, ${sqlText(r.city)}, ` +
        `${r.lng}, ${r.lat}, ${sqlText(r.website)}, ${sqlText(r.phone)})`
    )
    .join(',\n');

  return `-- ${rows.length} x ${categorySlug}, batch ${batch}
-- Source: OpenStreetMap contributors (ODbL). Attribution is a licence condition.
--
-- Undo this entire batch with:
--   delete from locations where import_batch = '${batch}';

begin;

with owner as (
  select id from profiles where username = ${sqlText(ownerUsername)}
), cat as (
  select id from categories where slug = ${sqlText(categorySlug)}
), candidates (name, address, city, lng, lat, website, phone) as (
  values
${values}
), inserted as (
  insert into locations
    (kind, name, address, city, country, geom, created_by,
     creator_visible, status, visibility, import_batch)
  select
    'place',
    c.name::text,
    c.address::text,
    c.city::text,
    'Sweden',
    ST_MakePoint(c.lng::double precision, c.lat::double precision)::geography,
    (select id from owner),
    -- No byline: nobody added these by hand, and claiming otherwise would be
    -- a lie on five thousand pages.
    false,
    'active',
    'public',
    ${sqlText(batch)}
  from candidates c
  where not exists (
    select 1 from locations l
    where l.name = c.name::text
      and ST_DWithin(
        l.geom,
        ST_MakePoint(c.lng::double precision, c.lat::double precision)::geography,
        100
      )
  )
  returning id
)
insert into location_categories (location_id, category_id)
select inserted.id, (select id from cat) from inserted;

commit;
`;
}

/** OSM puts the point on the element for nodes and under `center` for ways/relations. */
function coordsOf(el) {
  // A node is a single hand-placed point — nothing to compute.
  if (typeof el.lat === 'number' && typeof el.lon === 'number') return { lat: el.lat, lng: el.lon };

  // A way carries its vertices under `geometry` with `out geom`.
  const ring = (el.geometry ?? []).filter((p) => p && typeof p.lat === 'number');
  if (ring.length > 0) return centroidOf(ring);

  // A relation's members each carry their own geometry; pool them.
  const memberPoints = (el.members ?? []).flatMap((m) =>
    (m.geometry ?? []).filter((p) => p && typeof p.lat === 'number')
  );
  if (memberPoints.length > 0) return centroidOf(memberPoints);

  // Last resort: the bounding-box centre, which is what we used to use for
  // everything and is exactly the thing producing off pins.
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

/**
 * Area-weighted centroid of a closed ring, falling back to the mean vertex.
 *
 * The shoelace centroid sits inside a convex shape and is a far better pin than
 * the bounding-box centre for anything long or L-shaped. A degenerate ring —
 * three collinear points, or a line rather than an area — has zero area, and
 * the formula divides by it, so that case falls back to the average.
 */
function centroidOf(points) {
  let twiceArea = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const cross = a.lon * b.lat - b.lon * a.lat;
    twiceArea += cross;
    x += (a.lon + b.lon) * cross;
    y += (a.lat + b.lat) * cross;
  }
  if (Math.abs(twiceArea) > 1e-12) {
    return { lat: y / (3 * twiceArea), lng: x / (3 * twiceArea) };
  }
  const mean = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lon }), { lat: 0, lng: 0 });
  return { lat: mean.lat / points.length, lng: mean.lng / points.length };
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

/**
 * One OSM element as a candidate row.
 *
 * A missing name is fine — an outdoor gym or a pitch in a park usually has
 * none, and 253 of Stockholm's 321 outdoor gyms are unnamed. What a row cannot
 * do without is a point, because the pin is the thing that is expensive to fix
 * later; a name can be corrected in seconds.
 */
function toRow(el, categorySlug, batch) {
  const tags = el.tags ?? {};
  const point = coordsOf(el);
  if (!point) return null;
  const { address, city } = addressOf(tags);
  return {
    osm: `${el.type}/${el.id}`,
    name: tags.name ?? null,
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

const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fills in address and name from the coordinates, for rows OSM left bare.
 *
 * Needed because these categories carry almost no addr:* tags — not one of
 * Stockholm's 321 outdoor gyms has a full address in OSM — while the address is
 * the part that matters most here.
 *
 * Names come out as the street, else the suburb, else the town: "Sankt
 * Göransgatan", "Kungsholmen", "Nacka". No category prefix, because "Basketball
 * court — " on nine hundred rows is noise, and the category is already on the
 * card.
 *
 * ONE REQUEST PER SECOND, NOT NEGOTIABLE. Nominatim is donated infrastructure
 * and its usage policy caps automated use at this rate; going faster gets the
 * whole app's user agent blocked, not just this script. That makes a thousand
 * rows about seventeen minutes. Run it per city, per category, and let it take
 * the time.
 */
async function geocodeMissing(rows, onProgress) {
  let done = 0;
  for (const row of rows) {
    if (row.address && row.name) continue;

    try {
      const url =
        `${NOMINATIM}?format=jsonv2&lat=${row.lat}&lon=${row.lng}&zoom=18&addressdetails=1`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'LocaStar location import (support@locastar.se)' },
      });
      if (response.ok) {
        const a = (await response.json()).address ?? {};
        const area = a.suburb ?? a.city_district ?? a.neighbourhood ?? a.village ?? null;
        // Nominatim falls back to the municipality when a point sits outside any
        // named town, and Swedish municipalities carry the word: "Botkyrka
        // kommun". In an address line that reads like a council office rather
        // than a place, so drop the suffix — "146 54 Botkyrka" is what anyone
        // would write on an envelope.
        const town = (a.city ?? a.town ?? a.municipality ?? '').replace(/\s+kommun$/i, '') || null;

        if (!row.address) {
          const street = [a.road, a.house_number].filter(Boolean).join(' ');
          const locality = [a.postcode, town].filter(Boolean).join(' ');
          row.address = [street, locality].filter(Boolean).join(', ') || null;
          row.city = row.city ?? town;
        }
        // Street, then area, then town — most specific first.
        if (!row.name) row.name = a.road ?? area ?? town ?? null;
      }
    } catch {
      // Leave the row bare; the address filter below drops it.
    }

    done++;
    if (onProgress && done % 25 === 0) onProgress(done);
    await sleep(1100);
  }
}

/**
 * Runs the query, moving on from any mirror that cannot actually answer it.
 *
 * An empty result is treated as a failure worth retrying elsewhere, not as an
 * answer. Overpass reports several different problems as HTTP 200 with no
 * elements — an internal timeout (with a `remark`), and a regional instance
 * asked about somewhere outside its extract. The second is the dangerous one:
 * it is a confident, wrong "there are none here", and it silently produced an
 * empty import once already.
 *
 * A genuinely empty area therefore costs one extra request. That is a fair
 * price for never mistaking a broken mirror for a fact.
 */
async function queryOverpass(query) {
  const failures = [];
  for (const url of OVERPASS_MIRRORS) {
    const host = new URL(url).host;
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
      if (!response.ok) {
        failures.push(`${host} -> HTTP ${response.status}`);
        continue;
      }
      const payload = await response.json();
      if (payload.remark) {
        failures.push(`${host} -> ${payload.remark}`);
        continue;
      }
      if ((payload.elements ?? []).length === 0) {
        failures.push(`${host} -> 200 but no elements`);
        continue;
      }
      return payload;
    } catch (error) {
      failures.push(`${host} -> ${error.message}`);
    }
  }
  throw new Error(
    `No mirror returned data:\n  ${failures.join('\n  ')}\n\n` +
      'These are free shared servers, and 429/504/"no elements" usually mean busy\n' +
      'rather than broken — the same query often works a minute later. If every\n' +
      'mirror says "no elements" repeatedly, the area may genuinely have none.'
  );
}

async function main() {
  const [slug, areaKey, ...rest] = process.argv.slice(2);
  const flag = (name) => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : null;
  };
  const outFile = flag('--out');
  const sqlFile = flag('--sql');
  const owner = flag('--owner') ?? 'sam_86';
  const geocode = rest.includes('--geocode');

  if (!CATEGORIES[slug] || !AREAS[areaKey]) {
    console.error(
      'Usage: node tools/osm-import.mjs <category> <area> [--out file.json] [--sql file.sql] [--owner username]\n'
    );
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


  const named = elements.map((el) => toRow(el, slug, batch)).filter(Boolean);

  /*
   * Only rows that already carry an address are kept.
   *
   * Roughly two thirds of OSM entries have a name and a point and nothing
   * else, and importing those would mean either inventing addresses or
   * shipping thousands of locations that the edit screen — which requires an
   * address — cannot save without one being made up. Reverse-geocoding the gap
   * is out too: Nominatim allows about one request a second, so ten thousand
   * rows is three hours and outside its bulk-use policy.
   *
   * Losing two thirds is the right trade. The aim is a starting point good
   * enough to be worth opening, not a complete map — the rest is what the
   * people using it are for.
   */
  const unplaceable = elements.length - named.length;
  const needing = named.filter((r) => !r.address || !r.name).length;
  console.log(`  ${elements.length} elements in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`  ${unplaceable} skipped (no usable point)`);

  if (needing > 0) {
    if (!geocode) {
      console.log(`  ${needing} lack an address or a name in OSM`);
      console.log(`\n  Pass --geocode to fill those in from their coordinates.`);
      console.log(`  That is one request a second to Nominatim, so about ${Math.ceil((needing * 1.1) / 60)} min.`);
    } else {
      console.log(`  ${needing} need lookup — about ${Math.ceil((needing * 1.1) / 60)} min at 1 req/sec`);
      await geocodeMissing(named, (n) => console.log(`    ${n}/${needing}…`));
    }
  }

  const addressed = named.filter((r) => r.address && r.name);
  const { kept: rows, dropped } = dedupe(addressed);

  console.log(`  ${named.length - addressed.length} skipped (still no address)`);
  console.log(`  ${dropped.length} merged (same name within 100 m)`);
  console.log(`  ${rows.length} importable`);

  if (dropped.length > 0) {
    console.log(`\n  Merged — each of these was dropped in favour of the one kept (< ${MERGE_RADIUS_M} m):`);
    for (const d of dropped) {
      console.log(`    ${d.row.name}  (${d.metres.toFixed(0)} m apart)`);
      console.log(`      dropped: https://www.openstreetmap.org/${d.row.osm}`);
      console.log(`      kept   : https://www.openstreetmap.org/${d.into.osm}`);
    }
  }
  console.log(`  batch id: ${batch}\n`);

  for (const row of rows.slice(0, 15)) {
    console.log(
      `  ${row.name.slice(0, 38).padEnd(40)} ${row.lat.toFixed(4)},${row.lng.toFixed(4)}  ${row.address ?? '(no address)'}`
    );
  }
  if (rows.length > 15) console.log(`  … and ${rows.length - 15} more`);

  if (outFile) {
    writeFileSync(outFile, JSON.stringify({ batch, categorySlug: slug, rows }, null, 2));
    console.log(`\nWrote ${rows.length} rows to ${outFile}`);
  }

  if (sqlFile) {
    if (rows.length === 0) {
      console.log('\nNothing importable — no SQL written.');
    } else {
      writeFileSync(sqlFile, buildSql(rows, slug, batch, owner));
      console.log(`\nWrote SQL for ${rows.length} rows to ${sqlFile}`);
      console.log(`  owner: ${owner}   (created_by, with no visible byline)`);
      console.log(`  undo : delete from locations where import_batch = '${batch}';`);
    }
  }

  if (!outFile && !sqlFile) {
    console.log('\nDry run — nothing written. --out <file> for JSON, --sql <file> for the insert.');
  }
  console.log('\nStill inserted nothing. Running the SQL is a separate, deliberate step.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
