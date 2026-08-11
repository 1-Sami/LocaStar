// Sends the activity reminders that claim_activity_reminders() hands over.
//
// Deliberately thin. Every decision — which activities start tomorrow, who
// saved them, who still wants reminders, who is banned, who has already been
// told — lives in migration 0094, where it can be proved with a rolled-back
// probe instead of by pushing notifications at real phones. This function only
// carries the result to Expo.
//
// It is invoked on a schedule, not by a user, so it runs with the service role
// and there is no JWT to read. claim_activity_reminders() is granted to
// service_role only for that reason.

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

// Expo accepts up to 100 messages per request and asks that senders batch.
const BATCH_SIZE = 100;

type Claim = {
  push_token: string;
  platform: string;
  location_id: string;
  activity_name: string;
  starts_at: string;
};

type ExpoTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  // Scheduled invocation only. Rejecting anything else keeps this from being a
  // way for a stranger to make everyone's phone buzz.
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  // Claiming and reading are the same statement, so this call both marks the
  // reminders sent and returns them. A crash after this point loses a reminder
  // rather than sending it twice, which is the right way round for something
  // that buzzes a phone early in the morning.
  const claimRes = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_activity_reminders`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  if (!claimRes.ok) {
    return json({ error: 'claim failed', status: claimRes.status, body: await claimRes.text() }, 502);
  }

  const claims = (await claimRes.json()) as Claim[];
  if (claims.length === 0) return json({ claimed: 0, sent: 0, failed: 0 }, 200);

  const messages = claims.map((c) => ({
    to: c.push_token,
    title: c.activity_name,
    body: 'Starts tomorrow — you saved this.',
    sound: 'default',
    // Enough for the app to open the right screen when tapped. Nothing
    // sensitive: a push payload passes through Apple's and Google's servers.
    data: { locationId: c.location_id },
  }));

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
      });

      if (!res.ok) {
        failed += batch.length;
        errors.push(`expo ${res.status}: ${(await res.text()).slice(0, 200)}`);
        continue;
      }

      // Expo answers 200 with a per-message ticket, so a failure here is not
      // an HTTP error — an unregistered token comes back as a 200 with an
      // error ticket, and counting only the status would report success.
      const body = (await res.json()) as { data?: ExpoTicket[] };
      for (const ticket of body.data ?? []) {
        if (ticket.status === 'ok') sent += 1;
        else {
          failed += 1;
          if (errors.length < 10) errors.push(ticket.details?.error ?? ticket.message ?? 'unknown');
        }
      }
    } catch (error) {
      failed += batch.length;
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  // Returned rather than thrown so a partial failure still reports what did
  // get through; the schedule's logs are the only place anyone will look.
  return json({ claimed: claims.length, sent, failed, errors: errors.slice(0, 10) }, 200);
});
