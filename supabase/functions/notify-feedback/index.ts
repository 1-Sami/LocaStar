// Mails whatever product feedback has come in since the last sweep.
//
// The queue in the `feedback` table is the record; this is only the nudge that
// says go and look at it. Nothing here can lose a message — the worst outcome
// is a digest that does not arrive, and even that is retried, because a failed
// send puts the claim back (release_feedback_notifications).
//
// One digest rather than a mail per row, and every fifteen minutes rather than
// every two like the push sweep: nobody needs to hear about a feature request
// the moment it is typed, and four separate mails about four ideas is how an
// inbox learns to ignore a sender.
//
// Called by pg_cron with only the anon key, so verify_jwt is off — same as
// send-activity-reminders and send-social-notification-pushes. Triggering it
// from outside achieves nothing but an early digest: the recipient is the
// constant below, and what goes in it is decided by SQL.

import { SUPPORT_EMAIL, sendMail } from '../_shared/brevo.ts';
// Only the escaper is shared with the user-facing mail. This digest keeps its
// own plain styling on purpose: it goes to support@, it is a work queue, and
// dressing it in the LocaStar letterhead would make it look like a message
// somebody sent us.
import { escapeHtml } from '../_shared/email/layout.mjs';

type Claim = {
  id: string;
  category: 'general' | 'feature_request' | 'feature_removal';
  message: string;
  app_release: string;
  platform: string;
  created_at: string;
};

/*
 * English only, and deliberately not read from the app's catalogue.
 *
 * These labels go to one inbox, ours. The stored value is English for the same
 * reason the report reasons are (see 0120) — a queue half in Swedish cannot be
 * grouped — and shipping i18next into an edge function to translate three
 * strings for an audience of one would be absurd.
 */
const CATEGORY_LABELS: Record<Claim['category'], string> = {
  general: 'General feedback',
  feature_request: 'Request a feature',
  feature_removal: 'Remove a feature',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function digest(claims: Claim[]): { subject: string; html: string; text: string } {
  const subject =
    claims.length === 1
      ? 'New LocaStar feedback'
      : `${claims.length} new LocaStar feedback messages`;

  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:640px">
  <p style="color:#60646C;font-size:14px">Sent anonymously — there is no sender to reply to.</p>
  ${claims
    .map(
      (c) => `<div style="border-top:1px solid #E0E1E6;padding:16px 0">
    <div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#60646C">
      ${escapeHtml(CATEGORY_LABELS[c.category] ?? c.category)} &middot; ${escapeHtml(c.app_release)} &middot; ${escapeHtml(c.platform)}
    </div>
    <div style="font-size:15px;line-height:1.5;margin-top:6px;white-space:pre-wrap">${escapeHtml(c.message)}</div>
  </div>`
    )
    .join('')}
</div>`;

  const text = [
    'Sent anonymously — there is no sender to reply to.',
    '',
    ...claims.map(
      (c) =>
        `${CATEGORY_LABELS[c.category] ?? c.category} · ${c.app_release} · ${c.platform}\n${c.message}\n`
    ),
  ].join('\n');

  return { subject, html, text };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  const rpc = (name: string, body: string) =>
    fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body,
    });

  const claimRes = await rpc('claim_unnotified_feedback', '{}');
  if (!claimRes.ok) {
    return json({ error: 'claim failed', status: claimRes.status, body: await claimRes.text() }, 502);
  }

  const claims = (await claimRes.json()) as Claim[];
  if (claims.length === 0) return json({ claimed: 0, emailed: false }, 200);

  const ids = claims.map((c) => c.id);

  // Every path from here that does not send has to put the claim back, or the
  // next sweep skips these rows forever and the digest is silently lost.
  const release = async (why: string) => {
    console.error(`Releasing ${ids.length} feedback notification(s): ${why}`);
    const res = await rpc('release_feedback_notifications', JSON.stringify({ p_ids: ids }));
    if (!res.ok) {
      console.error('Could not release the claim', res.status, await res.text());
      return false;
    }
    return true;
  };

  const { subject, html, text } = digest(claims);

  const sent = await sendMail({ to: SUPPORT_EMAIL, subject, html, text });
  if (!sent.ok) {
    const released = await release(sent.reason);
    return json({ claimed: claims.length, emailed: false, released }, 200);
  }

  return json({ claimed: claims.length, emailed: true }, 200);
});
