// Carries the fifteen-day tester nudges that claim_tester_nudges() hands over.
//
// Deliberately thin, the same way send-activity-reminders is. Every decision —
// who is a tester, which day they are on, whether this is their slot, what the
// words are — lives in migration 0150, where it can be proved with a
// rolled-back probe instead of by pushing notifications at the owner's family.
// This function only carries the result to Expo.
//
// There is no language branch here, unlike the activity reminders: the copy is
// Swedish only, by instruction, and it arrives from SQL already assembled with
// its countdown. Nothing about a message is decided in this file.
//
// Invoked on a schedule, not by a user, so it runs with the service role and
// there is no JWT to read. claim_tester_nudges() is granted to service_role
// only for that reason.

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

// Expo accepts up to 100 messages per request and asks that senders batch.
const BATCH_SIZE = 100;

// The odd prefixes are not decoration. In a SQL-language function the output
// column names are in scope as parameters, and `day` and `platform` are real
// columns of the tables claim_tester_nudges() reads — so they are named to be
// impossible to confuse. See the migration.
type Claim = {
  push_token: string;
  device_platform: string;
  nudge_day: number;
  nudge_title: string;
  nudge_body: string;
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

  // Claiming and reading are one statement, so this call both records the
  // nudges as sent and returns them. A crash after this point loses a nudge
  // rather than repeating it.
  const claimRes = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_tester_nudges`, {
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
    title: c.nudge_title,
    body: c.nudge_body,
    sound: 'default',
    // Only which day it was, so a tap can be told apart from a share or a
    // friend request if the app ever wants to route on it. Nothing sensitive:
    // a push payload passes through Google's servers on the way.
    data: { testerNudgeDay: c.nudge_day },
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

      // Expo answers 200 with a per-message ticket, so a failure here is not an
      // HTTP error — an unregistered token comes back as a 200 with an error
      // ticket, and counting only the status would report success.
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

  // Returned rather than thrown so a partial failure still reports what got
  // through; the schedule's logs are the only place anyone will look.
  return json({ claimed: claims.length, sent, failed, errors: errors.slice(0, 10) }, 200);
});
