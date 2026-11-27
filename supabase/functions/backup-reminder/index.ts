// The monthly "back up LocaStar" email, with the month's numbers in it.
//
// On the free plan Supabase's own backups cannot be restored, so the owner
// takes one by hand with tools/backup.ps1 once a month (their choice,
// 2026-11-27). This is the reminder. pg_cron calls it on the 1st (see 0164).
//
// Called with only the anon key, so verify_jwt is off, like notify-feedback.
// That makes it callable by anyone, which is why the decision to send lives in
// SQL: claim_backup_reminder() returns stats at most once every 20 days and
// null otherwise. Poking this endpoint cannot flood the inbox.
//
// To support@, never a personal address: the owner's private email does not
// belong in code. The paths in the instructions are generic for the same
// reason.

import { SUPPORT_EMAIL, sendMail } from '../_shared/brevo.ts';

type Stats = {
  new_reviews: number;
  new_photos: number;
  new_accounts: number;
  new_user_places: number;
  reviews: number;
  accounts: number;
  photos: number;
  db_bytes: number;
  file_bytes: number;
};

// The free plan's ceilings. Worth a line in the mail once either is close,
// because hitting one is when the plan question stops being optional.
const DB_LIMIT_MB = 500;
const FILE_LIMIT_MB = 1024;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);

function compose(s: Stats): { subject: string; html: string; text: string } {
  const dbMb = mb(s.db_bytes);
  const fileMb = mb(s.file_bytes);
  const nearLimit = dbMb > DB_LIMIT_MB * 0.8 || fileMb > FILE_LIMIT_MB * 0.8;

  const lines = [
    "It's the start of the month: time to save a copy of LocaStar.",
    '',
    'The last 30 days:',
    `  ${s.new_reviews} new reviews, ${s.new_photos} new photos, ${s.new_accounts} new accounts, ${s.new_user_places} places added by users`,
    'In total:',
    `  ${s.reviews} reviews, ${s.accounts} accounts, ${s.photos} photo files`,
    'Free plan usage:',
    `  database ${dbMb} MB of ${DB_LIMIT_MB} MB, files ${fileMb} MB of ${FILE_LIMIT_MB} MB`,
    ...(nearLimit
      ? ['', 'Over 80% of a free-plan limit. Time to decide on a paid plan or a clean-up before it fills.']
      : []),
    '',
    'How to back up (about 2 minutes):',
    '  1. Open PowerShell in your LocaStar project folder.',
    '  2. Run:  powershell -ExecutionPolicy Bypass -File tools\\backup.ps1',
    '  3. Type the Supabase database password when asked.',
    '  4. Copy the new dated folder in LocaStar-backups (in your user folder) to a USB stick or another safe place.',
    '',
    'Why: on the free plan Supabase keeps daily backups but cannot restore them, so this copy is the only one that can bring back reviews, accounts and photos if something is deleted or goes wrong.',
  ];
  const text = lines.join('\n');

  // Plain on purpose, like the feedback digest: it is a note to ourselves, and
  // the letterhead would make it look like a message somebody sent us.
  const escape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<pre style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.55;white-space:pre-wrap">${escape(text)}</pre>`;

  return { subject: 'Time to back up LocaStar (monthly reminder)', html, text };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_backup_reminder`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (!res.ok) return json({ error: 'claim failed', status: res.status, body: await res.text() }, 502);

  const stats = (await res.json()) as Stats | null;
  // Already sent within the last 20 days. Nothing to do, and not an error.
  if (!stats) return json({ sent: false, reason: 'already sent recently' }, 200);

  const { subject, html, text } = compose(stats);
  const sent = await sendMail({ to: SUPPORT_EMAIL, subject, html, text });
  if (!sent.ok) {
    // 502 so a failing mailer shows on the error graph (see notify-feedback).
    // The claim is not put back: a missed monthly reminder is not worth a
    // retry loop, and next month's comes regardless.
    console.error('Backup reminder not sent:', sent.reason);
    return json({ sent: false, reason: sent.reason }, 502);
  }
  return json({ sent: true }, 200);
});
