// Every word LocaStar sends to a user, in one file.
//
// English only. Supabase renders one template per kind with no notion of the
// recipient's locale, so a Swedish variant would need the send_email auth hook
// — see the note at the top of render.mjs. Until then, one language beats a
// confirm mail in Swedish sitting next to a password reset in English, which
// is what we had.
//
// `vars` are substituted by render.mjs. In the generated dashboard templates
// they arrive as Go placeholders ({{ .ConfirmationURL }}); nothing here knows
// or cares.

/**
 * Each entry:
 *   subject    the Subject line — also written into the generated file's header
 *   preheader  the inbox preview line
 *   heading    the h1
 *   body       paragraphs, in order; may contain <strong>
 *   cta        { label, href } — omit entirely for the no-button templates
 *   panel      { html, tone } callout, rendered above the CTA
 *   code       a variable holding a token to show as a code block
 *   footnote   the quiet line in the footer
 */
export const COPY = {
  confirmation: {
    subject: 'Confirm your email address',
    preheader: 'One tap and your LocaStar account is ready.',
    heading: 'Confirm your email address',
    body: [
      'You created a LocaStar account — the map of courts, trails, swim spots and festivals near you, described by the people who have actually been there.',
      'Confirm your address to finish setting up.',
    ],
    cta: { label: 'Confirm email address', href: '{actionUrl}' },
    footnote:
      'If you didn&rsquo;t create an account, ignore this email. Nothing is added to your address unless the link is clicked.',
  },

  recovery: {
    subject: 'Reset your LocaStar password',
    preheader: 'The link works once, for one hour.',
    heading: 'Reset your password',
    body: [
      'Somebody asked to reset the password for the LocaStar account on this address. Choose a new one below.',
      'The link works once and expires in an hour.',
    ],
    cta: { label: 'Choose a new password', href: '{actionUrl}' },
    footnote:
      'Didn&rsquo;t ask for this? Ignore this email — your password stays as it is, and the link expires on its own.',
  },

  email_change: {
    subject: 'Confirm your new email address',
    preheader: 'Both addresses have to confirm before the change takes effect.',
    heading: 'Confirm your new email address',
    // Rendered twice — once to the old address, once to the new, each with its
    // own token. The copy has to read correctly in both inboxes at once, which
    // is why it names both addresses and says plainly that both must confirm.
    body: [
      'You asked to move your LocaStar account from <strong>{email}</strong> to <strong>{newEmail}</strong>.',
      'Confirm from <strong>this</strong> inbox to approve the change. Both addresses have to confirm before it takes effect, so check the other one too.',
    ],
    cta: { label: 'Confirm this address', href: '{actionUrl}' },
    footnote:
      'Didn&rsquo;t ask for this? Ignore both emails and nothing changes. If you can no longer sign in, email support straight away.',
  },

  magic_link: {
    subject: 'Your LocaStar sign-in link',
    preheader: 'Signs you in on this device. Good for one hour.',
    heading: 'Your sign-in link',
    body: [
      'Use the link below to sign in to LocaStar. It works once, on the device that opens it, and expires in an hour.',
    ],
    cta: { label: 'Sign in to LocaStar', href: '{actionUrl}' },
    footnote:
      'Didn&rsquo;t ask to sign in? Ignore this email. Nobody can use the link without this inbox.',
  },

  invite: {
    subject: 'You have been invited to LocaStar',
    preheader: 'Accept the invitation to set up your account.',
    heading: 'You have been invited to LocaStar',
    body: [
      'Somebody invited you to LocaStar — the map of courts, trails, swim spots and festivals near you, described by the people who have actually been there.',
      'Accept below to pick a password and get started.',
    ],
    cta: { label: 'Accept the invitation', href: '{actionUrl}' },
    footnote:
      'Not expecting this? Ignore this email — no account is created unless the link is clicked.',
  },

  // No ConfirmationURL, no RedirectTo. Supabase gives this template a token and
  // nothing else, so the code has to be the visual centre of the message.
  reauthentication: {
    subject: 'Your LocaStar sign-in code',
    preheader: 'Enter this code to confirm it is you.',
    heading: 'Confirm it&rsquo;s you',
    body: ['Enter this code in LocaStar to continue. It expires in ten minutes.'],
    code: '{token}',
    footnote:
      'Didn&rsquo;t try to sign in? Ignore this email — the code is useless on its own, and expires by itself.',
  },

  // A notification, not a template: different config block, and nothing to
  // click. Nothing to click is correct here — the only job is to be alarming
  // to the right person.
  password_changed: {
    subject: 'Your LocaStar password was changed',
    preheader: 'If this was not you, act now — here is how.',
    heading: 'Your password was changed',
    body: [
      'The password for your LocaStar account was changed a moment ago. If that was you, there is nothing to do.',
    ],
    panel: {
      tone: 'danger',
      html:
        '<strong>If it wasn&rsquo;t you</strong> — reset your password immediately at ' +
        '<a href="{siteUrl}/auth/forgot-password">locastar.se</a>, then email ' +
        '<a href="mailto:{supportEmail}">{supportEmail}</a>. Someone else may have reached your email account.',
    },
    footnote:
      'This is a security notice. LocaStar will never email you asking for your password.',
  },

  // Not a Supabase template — sent from the delete-account edge function via
  // Brevo, and the only one with a real plain-text part. The wording carries a
  // promise the Privacy Policy depends on: contributions survive, stripped of
  // the name. Change it there first.
  account_deleted: {
    subject: 'Your LocaStar account has been deleted',
    preheader: 'What was removed, what stays, and what to do if this was not you.',
    heading: 'Your account has been deleted',
    body: [
      'Your profile, username, picture, favourites, bucket list, lists and friends are gone for good.',
      'Reviews, photos and places you added stay in the app with your name removed, so the places other people rely on keep their ratings. They can no longer be traced back to you.',
      'This cannot be undone, and we cannot restore the account.',
    ],
    panel: {
      tone: 'danger',
      html:
        '<strong>Didn&rsquo;t do this?</strong> Email ' +
        '<a href="mailto:{supportEmail}">{supportEmail}</a> straight away — someone else ' +
        'may have access to your email account.',
    },
    footnote: 'Thanks for having been part of LocaStar.',
  },
};
