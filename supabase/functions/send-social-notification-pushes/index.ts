// Sends the push half of the notification types that only ever got the
// in-app half: friend requests, friend acceptances, location shares, list
// shares and role grants. claim_pending_notification_pushes() decides who is
// eligible and marks the row so a re-run cannot send it twice; this function
// only carries the result to Expo.
//
// Deliberately the same shape as send-activity-reminders — batch to Expo,
// count tickets not HTTP status — but text is built per `type` here instead
// of per `kind`, matching the five things notifications.tsx already renders.
//
// Scheduled every two minutes rather than once a day: a reminder about
// tomorrow can wait for a daily sweep, a friend request should not.

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

type Claim = {
  push_token: string;
  platform: string;
  type: 'friend_request' | 'friend_accepted' | 'share' | 'list_share' | 'role_granted';
  payload: Record<string, unknown>;
  locale: string;
};

/*
 * Mirrors the wording in apps/mobile/src/locales/{en,sv}.json under
 * `notifications.*`. Kept as plain strings for the same reason
 * send-activity-reminders does: four or five short lines do not justify
 * shipping i18next into an edge function, and nothing in the app's own
 * catalogue is reachable from here.
 */
function textFor(claim: Claim): { title: string; body: string } {
  const sv = claim.locale === 'sv';
  const name = (claim.payload.sender_name as string | undefined) ?? (sv ? 'Någon' : 'Someone');

  switch (claim.type) {
    case 'friend_request':
      return {
        title: sv ? `${name} har skickat en vänförfrågan` : `${name} sent you a friend request`,
        body: sv
          ? 'Tryck för att acceptera eller avböja den på din vänsida.'
          : 'Tap to accept or decline it on your Friends page.',
      };
    case 'friend_accepted':
      return {
        title: sv ? `${name} accepterade din vänförfrågan` : `${name} accepted your friend request`,
        body: sv
          ? 'Nu kan ni dela platser och listor med varandra.'
          : 'You can now share places and lists with each other.',
      };
    case 'list_share': {
      const listName = (claim.payload.list_name as string | undefined) ?? (sv ? 'Namnlös' : 'Untitled');
      return {
        title: sv ? `Delade listan "${listName}" med dig` : `Shared the list "${listName}" with you`,
        body: sv ? `Delad av ${name}` : `Shared by ${name}`,
      };
    }
    case 'role_granted':
      return {
        title: sv ? 'Du är nu superanvändare 🎉' : 'You’re now a Superuser 🎉',
        body: sv
          ? 'Tack för allt du har bidragit med till LocaStar.'
          : 'Thank you for everything you’ve contributed to LocaStar.',
      };
    case 'share':
    default: {
      const note = claim.payload.note as string | undefined;
      const locationName =
        (claim.payload.location_name as string | undefined) ?? (sv ? 'en plats' : 'a location');
      return {
        title: note ? `"${note}"` : sv ? `Delade ${locationName} med dig` : `Shared ${locationName} with you`,
        body: sv ? `Delad av ${name}` : `Shared by ${name}`,
      };
    }
  }
}

/** Enough for the app to open the right screen when tapped, same as reminders. */
function dataFor(claim: Claim): Record<string, unknown> {
  switch (claim.type) {
    case 'friend_request':
    case 'friend_accepted':
      return { screen: 'friends' };
    case 'list_share':
      return { listId: claim.payload.list_id };
    case 'role_granted':
      return { screen: 'notifications' };
    case 'share':
    default:
      return { locationId: claim.payload.location_id };
  }
}

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
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  const claimRes = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_pending_notification_pushes`, {
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

  const messages = claims.map((c) => {
    const { title, body } = textFor(c);
    return { to: c.push_token, title, body, sound: 'default', data: dataFor(c) };
  });

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

  return json({ claimed: claims.length, sent, failed, errors: errors.slice(0, 10) }, 200);
});
