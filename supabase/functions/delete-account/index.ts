// Deletes the caller's account, then tells them it happened.
//
// The deletion itself is still `delete_own_account()` — the same SECURITY
// DEFINER function the app has always called, invoked here with the caller's
// own token so every policy and guard applies exactly as before. This function
// adds one thing: the confirmation email, which has to be sent from a trusted
// context because the address it goes to must come from the verified JWT and
// never from the request body. Otherwise it is an open relay for sending
// "your account was deleted" mail to strangers.
//
// Order matters. The email is sent only after the delete succeeds, so nobody
// is ever told their account is gone while it is still there. And the client
// falls back to calling the RPC directly if this function is unreachable, so a
// mail outage can never trap someone in an account they want to leave.

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const SENDER = { name: 'LocaStar', email: 'no-reply@locastar.se' };
const SUPPORT_EMAIL = 'support@locastar.se';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/**
 * The email address out of an already-verified JWT.
 *
 * The platform validates the signature before this function ever runs, so this
 * only has to read the payload — but it must still be the *only* source of the
 * address, for the open-relay reason above.
 */
function emailFromJwt(authHeader: string): string | null {
  try {
    const payload = authHeader.replace(/^Bearer\s+/i, '').split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    ) as { email?: string };
    return decoded.email ?? null;
  } catch {
    return null;
  }
}

/**
 * The project's publishable key, for when SUPABASE_ANON_KEY finally goes.
 *
 * The dashboard marks SUPABASE_ANON_KEY deprecated in favour of
 * SUPABASE_PUBLISHABLE_KEYS, which is a JSON dictionary rather than a bare
 * key — so it cannot simply be read as a drop-in replacement. Parsed leniently
 * because the exact shape is Supabase's to change, and the alternative to
 * guessing wrong here is the deletion email silently never sending.
 */
function publishableKey(): string | null {
  const raw = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const values = Array.isArray(parsed) ? parsed : Object.values(parsed);
    for (const value of values) {
      if (typeof value === 'string' && value) return value;
      const nested = (value as { api_key?: unknown })?.api_key;
      if (typeof nested === 'string' && nested) return nested;
    }
    return null;
  } catch {
    // Not JSON after all — treat it as the key itself rather than giving up.
    return raw;
  }
}

function emailBody() {
  const text = [
    'Your LocaStar account has been deleted.',
    '',
    'Your profile, username, picture, home address, favourites, bucket list,',
    'lists and friends are gone for good. Reviews, photos and places you added',
    'stay in the app with your name removed, so the places other people rely on',
    'keep their ratings — they can no longer be traced back to you.',
    '',
    'This cannot be undone, and we cannot restore the account.',
    '',
    `If you did not do this, please email us at ${SUPPORT_EMAIL} straight away.`,
    'Someone else may have access to your email account.',
    '',
    'Thanks for having been part of LocaStar.',
  ].join('\n');

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f6f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1b2b2f;line-height:1.55">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
    <h1 style="margin:0 0 16px;font-size:20px;color:#125F6F">Your LocaStar account has been deleted</h1>
    <p style="margin:0 0 14px">Your profile, username, picture, home address, favourites, bucket list, lists and friends are gone for good.</p>
    <p style="margin:0 0 14px">Reviews, photos and places you added stay in the app with your name removed, so the places other people rely on keep their ratings. They can no longer be traced back to you.</p>
    <p style="margin:0 0 20px">This cannot be undone, and we cannot restore the account.</p>
    <div style="border-left:3px solid #E05252;padding:2px 0 2px 14px;margin:0 0 20px">
      <p style="margin:0"><strong>Didn't do this?</strong> Email us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#125F6F">${SUPPORT_EMAIL}</a> straight away — someone else may have access to your email account.</p>
    </div>
    <p style="margin:0;color:#5d6b6f;font-size:14px">Thanks for having been part of LocaStar.</p>
  </div>
</body></html>`;

  return { text, html };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Not signed in' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? publishableKey();
  if (!supabaseUrl || !anonKey) {
    console.error('Missing SUPABASE_URL or project key — cannot reach PostgREST');
    return json({ error: 'Server misconfigured' }, 500);
  }

  // Delete first, as the caller. Straight PostgREST rather than supabase-js:
  // one RPC needs no client library, and no dependency means nothing to break
  // on a future Deno runtime bump.
  const rpc = await fetch(`${supabaseUrl}/rest/v1/rpc/delete_own_account`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  if (!rpc.ok) {
    const detail = await rpc.text();
    console.error('delete_own_account failed', rpc.status, detail);
    return json({ error: 'Could not delete the account' }, 500);
  }

  // Past this point the account is gone. Nothing below is allowed to turn that
  // into a failure the person sees, so every problem is logged and swallowed.
  const address = emailFromJwt(authHeader);
  const apiKey = Deno.env.get('BREVO_API_KEY');

  if (!address) {
    console.error('Account deleted but the JWT carried no email address');
    return json({ deleted: true, emailed: false }, 200);
  }
  if (!apiKey) {
    console.error('Account deleted but BREVO_API_KEY is not set — no email sent');
    return json({ deleted: true, emailed: false }, 200);
  }

  const { text, html } = emailBody();
  try {
    const mail = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: SENDER,
        to: [{ email: address }],
        subject: 'Your LocaStar account has been deleted',
        htmlContent: html,
        textContent: text,
      }),
    });

    if (!mail.ok) {
      console.error('Brevo rejected the message', mail.status, await mail.text());
      return json({ deleted: true, emailed: false }, 200);
    }
  } catch (cause) {
    console.error('Could not reach Brevo', cause);
    return json({ deleted: true, emailed: false }, 200);
  }

  return json({ deleted: true, emailed: true }, 200);
});
