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
  // Excluding shops rather than requiring a leisure tag: outdoor crags are
  // tagged natural=cliff with no leisure at all, and they are the point of the
  // category. A climbing shop is not somewhere to climb.
  climbing: { filters: ['["sport"="climbing"]["shop"!~"."]'] },
  // Free admission only, which is the whole point of the category. fee=no is
  // the explicit tag; museums with no fee tag at all are left out rather than
  // guessed at, because "we thought it was free" is a bad reason for a wasted trip.
  'museums-free': { filters: ['["tourism"="museum"]["fee"="no"]'] },
  playgrounds: { filters: ['["leisure"="playground"]'] },
  'gyms-outside': { filters: ['["leisure"="fitness_station"]', '["leisure"="fitness_centre"]["outdoor"="yes"]'] },
  // leisure=pitch AND the sport, not the sport alone. sport=* is tagged on
  // anything to do with the game, so filtering on it by itself imported the IFK
  // Göteborg club shop, the Malmö FF shop and the Uppland football association's
  // office as "football courts". A pitch is the thing you can actually go and
  // play on.
  basketball: { filters: ['["leisure"="pitch"]["sport"="basketball"]'] },
  // soccer, not football: OSM uses football loosely and it would drag in
  // American football and rugby.
  football: { filters: ['["leisure"="pitch"]["sport"="soccer"]'] },
  'dog-parks': { filters: ['["leisure"="dog_park"]'] },
  skatepark: { filters: ['["leisure"="skatepark"]', '["sport"="skateboard"]'] },
  /*
   * Golf is the first category made of genuinely large polygons, and the
   * centroid is the wrong pin for it.
   *
   * A pitch, a library, a fitness station: the middle of the shape is the
   * place. A golf course is 400 m to 2.9 km across, and its middle is out on
   * the fairways — measured across ten cities, the centroid sits 160-385 m
   * from the clubhouse, sometimes with no road anywhere near it. Directions to
   * that point send someone into a hedge.
   *
   * So a course is pinned at something a visitor actually arrives at, and a
   * course with no such thing mapped is not imported at all. That drops well
   * over half of them, which is the right way round: a missing course is an
   * invitation to add one, a course pinned in the rough is a wasted trip.
   *
   * Ranked — a clubhouse beats a car park, and among equals the one nearest
   * the middle of the course wins, because a big club can have a maintenance
   * yard tagged the same way out by the perimeter.
   */
  golf: {
    filters: ['["leisure"="golf_course"]'],
    primary: (tags) => tags.leisure === 'golf_course',
    anchors: [
      ['golf', 'clubhouse'],
      ['leisure', 'clubhouse'],
      ['building', 'clubhouse'],
      ['amenity', 'parking'],
    ],
  },

  // --- Pitches. All the same shape: the sport, on something you can play on. ---
  tennis: { filters: ['["leisure"="pitch"]["sport"="tennis"]'] },
  volleyball: {
    // Beach volleyball is tagged separately and is the more common of the two
    // in Sweden; both belong under one category here.
    filters: ['["leisure"="pitch"]["sport"="volleyball"]', '["leisure"="pitch"]["sport"="beachvolleyball"]'],
  },
  cricket: { filters: ['["leisure"="pitch"]["sport"="cricket"]'] },
  'amerikan-fotball': { filters: ['["leisure"="pitch"]["sport"="american_football"]'] },
  // OSM spells it boules; pétanque is recorded underneath as a variant.
  boule: { filters: ['["leisure"="pitch"]["sport"="boules"]'] },
  parkour: { filters: ['["sport"="parkour"]'] },
  // Requiring a leisure tag of some kind — pitch, sports_centre, track. Without
  // it, sport=archery alone imported "Bågar & Pilar" on Triewaldsgränd, which
  // is a bow shop in Gamla Stan, not somewhere to shoot.
  'archery-ranges': { filters: ['["sport"="archery"]["leisure"]'] },
  'track-and-field-stadium': { filters: ['["leisure"="track"]["sport"="athletics"]'] },

  // --- Small standalone features. The middle of the shape is the place. ---
  'grill-sites': { filters: ['["amenity"="bbq"]'] },
  'picknick-parks': { filters: ['["tourism"="picnic_site"]'] },
  camping: { filters: ['["tourism"="camp_site"]'] },
  'disc-golf-frisbee': { filters: ['["leisure"="disc_golf_course"]'] },
  // Ruins, castles and dig sites. historic=memorial and =monument are left out:
  // a plaque on a wall is not somewhere to go and spend an afternoon.
  'historical-ruins-places': {
    filters: ['["historic"="ruins"]', '["historic"="castle"]', '["historic"="archaeological_site"]'],
  },
  // Outdoor pools only. A pool with no location tag is assumed outdoor, which
  // is the common case in Sweden; explicit indoor ones are excluded.
  swimming: {
    filters: ['["leisure"="swimming_area"]', '["leisure"="swimming_pool"]["location"!="indoor"]["access"!="private"]'],
  },
  beaches: { filters: ['["natural"="beach"]'] },
  /*
   * Swedish 4H farms have no tag of their own anywhere in OSM, so the name is
   * the only signal there is.
   *
   * It has to match "4H" as a whole word, though. A bare substring search
   * imported "Top4Hair", a hairdresser in Järfälla, and "24HR Malmö" — the
   * letters are there, surrounded by the wrong things. The guards either side
   * require a non-alphanumeric or the end of the string.
   */
  '4h-farms': { filters: ['["name"~"(^|[^0-9A-Za-z])4H([^0-9A-Za-z]|$)"]'] },
  // High ropes, adventure and theme parks — the paid day-out kind.
  'action-parks': {
    filters: ['["attraction"="high_ropes"]', '["tourism"="theme_park"]', '["sport"="climbing_adventure"]'],
  },
  'race-tracks-vehicle': { filters: ['["highway"="raceway"]', '["leisure"="track"]["sport"="motor"]'] },
  outdoor: { filters: ['["leisure"="recreation_ground"]'] },

  /*
   * Large polygons, pinned the same way golf is: at the car park.
   *
   * A nature reserve is kilometres across and its middle is somewhere in the
   * forest. The car park is the trailhead — it is where the sign, the map board
   * and the road are, and it is where anyone going there actually starts. A
   * reserve with no parking mapped is left out rather than pinned into the
   * woods.
   */
  'nature-reserves': {
    filters: ['["leisure"="nature_reserve"]'],
    primary: (tags) => tags.leisure === 'nature_reserve',
    anchors: [
      ['tourism', 'information'],
      ['amenity', 'parking'],
    ],
  },
  skiing: {
    filters: ['["landuse"="winter_sports"]'],
    primary: (tags) => tags.landuse === 'winter_sports',
    anchors: [
      ['amenity', 'parking'],
      ['building', 'yes'],
    ],
  },
};

/**
 * Bounding boxes as Overpass wants them: south,west,north,east.
 *
 * `sweden` covers the whole country and is deliberately a poor choice for a
 * capped run: farthest-point selection maximises distance, so a national bbox
 * spends the budget on Kiruna, Gotland and the far south while barely touching
 * the places most people live. Name the cities instead.
 */
const AREAS = {
  stockholm: { bbox: '59.20,17.75,59.50,18.30', label: 'Stockholm' },
  gothenburg: { bbox: '57.60,11.80,57.80,12.10', label: 'Göteborg' },
  malmo: { bbox: '55.53,12.90,55.65,13.10', label: 'Malmö' },
  uppsala: { bbox: '59.79,17.55,59.92,17.75', label: 'Uppsala' },
  vasteras: { bbox: '59.57,16.45,59.66,16.62', label: 'Västerås' },
  orebro: { bbox: '59.22,15.13,59.32,15.30', label: 'Örebro' },
  linkoping: { bbox: '58.35,15.53,58.45,15.68', label: 'Linköping' },
  helsingborg: { bbox: '56.00,12.66,56.10,12.78', label: 'Helsingborg' },
  jonkoping: { bbox: '57.72,14.10,57.82,14.25', label: 'Jönköping' },
  norrkoping: { bbox: '58.55,16.10,58.63,16.25', label: 'Norrköping' },
  lund: { bbox: '55.68,13.15,55.75,13.25', label: 'Lund' },
  umea: { bbox: '63.78,20.20,63.86,20.35', label: 'Umeå' },
  gavle: { bbox: '60.63,17.10,60.72,17.22', label: 'Gävle' },
  boras: { bbox: '57.70,12.90,57.76,13.00', label: 'Borås' },
  sodertalje: { bbox: '59.17,17.58,59.24,17.68', label: 'Södertälje' },
  eskilstuna: { bbox: '59.30,16.40,59.45,16.65', label: 'Eskilstuna' },
  karlstad: { bbox: '59.35,13.45,59.42,13.55', label: 'Karlstad' },
  vaxjo: { bbox: '56.85,14.75,56.92,14.85', label: 'Växjö' },
  sundsvall: { bbox: '62.37,17.25,62.42,17.36', label: 'Sundsvall' },
  lulea: { bbox: '65.55,22.10,65.65,22.25', label: 'Luleå' },
  sweden: { bbox: '55.00,10.50,69.10,24.20', label: 'Sweden' },
};

/** A sensible national spread: the big three plus a reach up and down the country. */
const NATIONWIDE = [
  'stockholm',
  'gothenburg',
  'malmo',
  'uppsala',
  'orebro',
  'linkoping',
  'umea',
  'gavle',
  'vaxjo',
  'lulea',
];

/**
 * One query covering every requested area.
 *
 * Overpass takes a union, so ten cities is one request rather than ten. That
 * matters more than it sounds: each round trip to a busy free server can take
 * minutes, and ten sequential ones turned a job into a coffee break. Rows are
 * assigned back to their city afterwards by checking which box contains them,
 * which the coordinates already answer.
 */
function buildQuery(filters, bboxes, anchors = null) {
  const boxes = Array.isArray(bboxes) ? bboxes : [bboxes];
  const parts = boxes
    .flatMap((bbox) =>
      filters.flatMap((f) => [`node${f}(${bbox});`, `way${f}(${bbox});`, `relation${f}(${bbox});`])
    )
    .join('\n  ');

  // `out geom` rather than `out center`. Overpass's "center" is the middle of
  // the bounding box, which it documents as possibly falling outside the object
  // — for an L-shaped building or a pitch on an odd plot, the pin lands off the
  // thing it is supposed to mark. With the real vertex list we can compute a
  // proper centroid instead.
  if (!anchors) return `[out:json][timeout:180];\n(\n  ${parts}\n);\nout geom tags;`;

  /*
   * Anchors are fetched inside the matched polygons, not across the bounding
   * boxes.
   *
   * The obvious version — ask for every amenity=parking in the ten city boxes
   * and sort it out here — returns 26,000 elements and times the query out.
   * map_to_area turns the courses themselves into search areas, so Overpass
   * only ever looks at car parks that are already on a golf course, and the
   * answer comes back in seconds.
   */
  const anchorParts = anchors
    .map(([key, value]) => `nwr["${key}"="${value}"](area.courses);`)
    .join('\n  ');
  return (
    `[out:json][timeout:300];\n` +
    `(\n  ${parts}\n)->.primary;\n` +
    `.primary map_to_area ->.courses;\n` +
    `(\n  ${anchorParts}\n)->.anchors;\n` +
    `(.primary; .anchors;);\nout geom tags;`
  );
}

/**
 * The closed rings of an element, for point-in-polygon tests.
 *
 * A way carries its own vertices. A relation's outer members are separate open
 * ways that together form the boundary; concatenating them in member order
 * reproduces the ring closely enough to say what is inside a golf course, which
 * is all this is used for.
 */
function ringsOf(el) {
  if (el.type === 'way') {
    const ring = (el.geometry ?? []).filter((p) => p && typeof p.lat === 'number');
    return ring.length >= 3 ? [ring] : [];
  }
  if (el.type === 'relation') {
    const outer = (el.members ?? [])
      .filter((m) => m.role !== 'inner' && m.geometry?.length)
      .flatMap((m) => m.geometry.filter((p) => p && typeof p.lat === 'number'));
    return outer.length >= 3 ? [outer] : [];
  }
  return [];
}

/**
 * Ray casting, deliberately not a bounding-box test.
 *
 * Golf courses are wildly non-convex — they wrap around lakes, roads and whole
 * housing estates. A bbox test would claim half the neighbourhood belongs to
 * the course and happily pin a club at a supermarket car park across the road.
 */
function ringContains(ring, point) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j];
    const b = ring[i];
    if (a.lat > point.lat !== b.lat > point.lat) {
      const crossing = ((b.lon - a.lon) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lon;
      if (point.lng < crossing) inside = !inside;
    }
  }
  return inside;
}

/**
 * Where to actually put the pin for a large polygon: the best anchor inside it,
 * or null when nothing suitable is mapped and the row should be dropped.
 */
function anchorPointFor(el, anchors) {
  const rings = ringsOf(el);
  if (rings.length === 0) return null;

  const inside = anchors.filter((a) => rings.some((ring) => ringContains(ring, a.point)));
  if (inside.length === 0) return null;

  const bestRank = Math.min(...inside.map((a) => a.rank));
  const centre = coordsOf(el);
  return inside
    .filter((a) => a.rank === bestRank)
    .sort((a, b) => metresBetween(centre, a.point) - metresBetween(centre, b.point))[0].point;
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

/**
 * How many rows one run may import, unless --max says otherwise.
 *
 * The aim is to kickstart an area, not to fill it: somewhere under a fifth of
 * what is really out there, with the rest left for the people who actually go.
 * A map that already claims to know everywhere gives nobody a reason to add
 * anything, and an import cannot say whether the hoop is bent.
 */
const DEFAULT_MAX_ROWS = 50;

/**
 * Picks n rows spread across the area rather than the first n found.
 *
 * Overpass returns roughly in id order, which is the order things were mapped —
 * so the first fifty are typically fifty courts in whichever suburb one
 * enthusiast surveyed. Farthest-point selection instead takes the most distant
 * candidate each time, giving a seed that covers the region.
 *
 * Done BEFORE geocoding on purpose. Geocoding is the slow part at one request a
 * second, and there is no sense spending four minutes on two hundred rows to
 * then throw away three quarters of them. Choosing first needs only the
 * coordinates, which are already in hand.
 */
function pickSpread(rows, n) {
  if (rows.length <= n) return rows;
  const picked = [rows[0]];
  const rest = rows.slice(1);
  while (picked.length < n && rest.length > 0) {
    let bestIndex = 0;
    let bestDistance = -1;
    for (let i = 0; i < rest.length; i++) {
      // Distance to the nearest already-picked row: maximise it.
      let nearest = Infinity;
      for (const p of picked) {
        const d = metresBetween(p, rest[i]);
        if (d < nearest) nearest = d;
      }
      if (nearest > bestDistance) {
        bestDistance = nearest;
        bestIndex = i;
      }
    }
    picked.push(rest.splice(bestIndex, 1)[0]);
  }
  return picked;
}

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
function toRow(el, categorySlug, batch, pointOverride = null) {
  const tags = el.tags ?? {};
  // An override is the anchor point for a large polygon — the clubhouse rather
  // than the middle of the fairways. See the golf entry in CATEGORIES.
  const point = pointOverride ?? coordsOf(el);
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
async function queryOverpass(query, { attempts = 4 } = {}) {
  const failures = [];
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (attempt > 1) {
      // Overpass throttles per IP and stays throttled for a while. Backing off
      // 20s, 40s, 80s costs a couple of minutes on a bad day and turns a failed
      // run into a slow one — which for a job this size is the better trade.
      const wait = 10_000 * 2 ** (attempt - 1);
      console.log(`  busy — waiting ${wait / 1000}s before retry ${attempt - 1}/${attempts - 1}`);
      await sleep(wait);
    }
    const result = await tryMirrors(query, failures);
    if (result) return result;
  }
  throw new Error(
    `No mirror returned data after ${attempts} attempts:\n  ${failures.slice(-4).join('\n  ')}\n\n` +
      'These are free shared servers and throttle per IP. If a big run just\n' +
      'finished, give it ten minutes rather than retrying immediately.'
  );
}

async function tryMirrors(query, failures) {
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
  // Null rather than throwing: the caller decides whether to back off and retry.
  return null;
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
  const maxRows = Number(flag('--max') ?? DEFAULT_MAX_ROWS);

  // "nationwide", or a comma-separated list, or one area.
  const areaKeys =
    areaKey === 'nationwide' ? NATIONWIDE : (areaKey ?? '').split(',').filter(Boolean);

  if (!CATEGORIES[slug] || areaKeys.length === 0 || areaKeys.some((k) => !AREAS[k])) {
    console.error(
      'Usage: node tools/osm-import.mjs <category> <area[,area...]|nationwide>\n' +
        '                                 [--geocode] [--max n] [--out f.json] [--sql f.sql] [--owner user]\n'
    );
    console.error('  categories:', Object.keys(CATEGORIES).join(', '));
    console.error('  areas     :', Object.keys(AREAS).join(', '));
    console.error('  nationwide:', NATIONWIDE.join(', '));
    process.exit(1);
  }

  const areaLabel = areaKey === 'nationwide' ? 'nationwide' : areaKeys.join('+');
  const batch = `osm-${areaLabel}-${slug}-${new Date().toISOString().slice(0, 10)}`;

  /*
   * The cap is divided evenly between the areas, not applied to the pool.
   *
   * Selecting across a combined pool would hand the whole budget to whichever
   * cities sit furthest apart — farthest-point selection rewards distance, so
   * Luleå and Malmö would crowd out everywhere between them. An even share
   * guarantees every named city gets some, and the spread still applies within
   * each one.
   */
  const perArea = Math.max(1, Math.floor(maxRows / areaKeys.length));
  const started = Date.now();

  const category = CATEGORIES[slug];
  console.log(`Overpass: ${slug} across ${areaKeys.length} areas, ${perArea} each`);
  const elements =
    (
      await queryOverpass(
        buildQuery(
          category.filters,
          areaKeys.map((k) => AREAS[k].bbox),
          category.anchors ?? null
        )
      )
    ).elements ?? [];
  console.log(`  ${elements.length} elements in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);

  let allRows;
  if (!category.anchors) {
    allRows = elements.map((el) => toRow(el, slug, batch)).filter(Boolean);
  } else {
    // One response holds both the courses and the things inside them; the
    // primary predicate is what tells them apart.
    const isPrimary = (el) => category.primary(el.tags ?? {});
    const rank = (el) =>
      category.anchors.findIndex(([key, value]) => (el.tags ?? {})[key] === value);
    const anchorPoints = elements
      .filter((el) => !isPrimary(el))
      .map((el) => ({ rank: rank(el), point: coordsOf(el) }))
      .filter((a) => a.rank >= 0 && a.point);

    const courses = elements.filter(isPrimary);
    allRows = courses
      .map((el) => {
        const point = anchorPointFor(el, anchorPoints);
        return point ? toRow(el, slug, batch, point) : null;
      })
      .filter(Boolean);
    console.log(
      `  ${courses.length} courses, ${anchorPoints.length} anchors → ` +
        `${allRows.length} placeable, ${courses.length - allRows.length} dropped (nothing to pin to)\n`
    );
  }

  // Bucket by the box each row falls in, then spread within each city. Doing it
  // per city rather than over the pool is the point: farthest-point selection
  // rewards distance, so across a combined pool Luleå and Malmö would crowd out
  // everywhere in between.
  const named = [];
  for (const key of areaKeys) {
    const [south, west, north, east] = AREAS[key].bbox.split(',').map(Number);
    const inside = allRows.filter(
      (r) => r.lat >= south && r.lat <= north && r.lng >= west && r.lng <= east
    );
    const picked = pickSpread(inside, perArea);
    named.push(...picked);
    console.log(
      `  ${AREAS[key].label.padEnd(14)}${String(inside.length).padStart(5)} found → ${picked.length} picked`
    );
  }
  console.log();

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
  console.log(`  ${named.length} selected (${perArea} per area, spread within each)`);

  // Already capped per area above; this is only the belt-and-braces trim when
  // the even split leaves a remainder.
  const candidates = pickSpread(named, maxRows);

  const needing = candidates.filter((r) => !r.address || !r.name).length;
  if (needing > 0) {
    if (!geocode) {
      console.log(`  ${needing} lack an address or a name in OSM`);
      console.log(`\n  Pass --geocode to fill those in from their coordinates.`);
      console.log(`  That is one request a second to Nominatim, so about ${Math.ceil((needing * 1.1) / 60)} min.`);
    } else {
      console.log(`  ${needing} need lookup — about ${Math.ceil((needing * 1.1) / 60)} min at 1 req/sec`);
      await geocodeMissing(candidates, (n) => console.log(`    ${n}/${needing}…`));
    }
  }

  const addressed = candidates.filter((r) => r.address && r.name);
  const { kept: rows, dropped } = dedupe(addressed);

  console.log(`  ${candidates.length - addressed.length} skipped (still no address)`);
  console.log(`  ${dropped.length} merged (same name within ${MERGE_RADIUS_M} m)`);
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
