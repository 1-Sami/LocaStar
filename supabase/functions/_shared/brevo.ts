// The one place that talks to Brevo.
//
// Both mail-sending functions used to carry their own copy of the endpoint,
// the sender, the headers and the payload shape. They had already drifted on
// everything except the URL.
//
// .ts rather than .mjs because this reads Deno.env, so unlike the email layout
// it is not shared with the Node template generator.

export const SENDER = { name: 'LocaStar', email: 'no-reply@locastar.se' };
export const SUPPORT_EMAIL = 'support@locastar.se';

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

export type SendResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Sends one message, and never throws.
 *
 * Both callers have something they must do when a send fails and neither can
 * afford an exception to skip it: delete-account has already deleted the
 * account and must still report success, and notify-feedback must put its
 * claim back or the digest is lost forever. So every failure comes back as a
 * value, with a reason worth logging.
 */
export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const apiKey = Deno.env.get('BREVO_API_KEY');
  if (!apiKey) return { ok: false, reason: 'BREVO_API_KEY is not set' };

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: SENDER,
        to: [{ email: opts.to }],
        subject: opts.subject,
        htmlContent: opts.html,
        textContent: opts.text,
      }),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      return { ok: false, reason: `Brevo rejected the message (${res.status}: ${detail})` };
    }
    return { ok: true };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return { ok: false, reason: `could not reach Brevo (${message})` };
  }
}
