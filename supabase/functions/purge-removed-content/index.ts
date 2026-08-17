// Empties the moderation trash: content removed more than thirty days ago.
//
// The database decides what is due — expired_removed_content() is the only
// place the retention window and the "removed, and stamped, and not already
// disappearing by cascade" rules live. This function carries out what it is
// told and does not second-guess it.
//
// Order matters and is the whole reason this is not a cron DELETE. Storage
// objects go first, rows second. The media bucket is public, so a row deleted
// while its object survives leaves the picture fetchable by anyone holding its
// URL — for something removed *because* it was inappropriate, that is the
// failure worth designing against. Doing storage first means a crash in the
// middle leaves rows that are still due, and the next run repeats the work;
// removing an object twice is a no-op.

const RETENTION_NOTE = '30 days, enforced in expired_removed_content()';

type Expired = {
  kind: 'location' | 'review' | 'location_photo' | 'review_photo';
  row_id: string;
  storage_paths: string[];
};

const TABLE_BY_KIND: Record<Expired['kind'], string> = {
  location: 'locations',
  review: 'reviews',
  location_photo: 'location_photos',
  review_photo: 'review_photos',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  const dueRes = await fetch(`${supabaseUrl}/rest/v1/rpc/expired_removed_content`, {
    method: 'POST',
    headers,
    body: '{}',
  });
  if (!dueRes.ok) {
    return json({ error: 'could not read what is due', status: dueRes.status, body: await dueRes.text() }, 502);
  }

  const due = (await dueRes.json()) as Expired[];
  if (due.length === 0) return json({ retention: RETENTION_NOTE, due: 0, objects: 0, rows: 0 }, 200);

  // Every path under everything due, including what would go by cascade.
  const paths = [...new Set(due.flatMap((row) => row.storage_paths ?? []))].filter(Boolean);

  let objectsRemoved = 0;
  if (paths.length > 0) {
    const storageRes = await fetch(`${supabaseUrl}/storage/v1/object/media`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ prefixes: paths }),
    });
    if (!storageRes.ok) {
      // Deliberately fatal. Deleting the rows now would strand the objects
      // permanently: nothing would remember they were ever due.
      return json(
        { error: 'storage delete failed, rows left intact', status: storageRes.status, body: (await storageRes.text()).slice(0, 300) },
        502
      );
    }
    objectsRemoved = paths.length;
  }

  let rowsDeleted = 0;
  const failures: string[] = [];
  // Photos before reviews before locations, so a cascade never removes a row
  // this loop is about to ask for by id.
  const order: Expired['kind'][] = ['review_photo', 'location_photo', 'review', 'location'];
  for (const kind of order) {
    const ids = due.filter((row) => row.kind === kind).map((row) => row.row_id);
    if (ids.length === 0) continue;
    const res = await fetch(
      `${supabaseUrl}/rest/v1/${TABLE_BY_KIND[kind]}?id=in.(${ids.join(',')})`,
      { method: 'DELETE', headers }
    );
    if (res.ok) rowsDeleted += ids.length;
    else failures.push(`${kind}: ${res.status} ${(await res.text()).slice(0, 120)}`);
  }

  return json(
    { retention: RETENTION_NOTE, due: due.length, objects: objectsRemoved, rows: rowsDeleted, failures },
    failures.length > 0 ? 500 : 200
  );
});
