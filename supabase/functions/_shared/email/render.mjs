// Turns an entry in copy.mjs into a finished email.
//
// The trick that lets one renderer serve two very different consumers:
// Supabase's {{ .X }} placeholders are just strings. The template generator
// passes the Go literals, the delete-account function passes real values, and
// this file cannot tell the difference.
//
//   renderAuthEmail('recovery', { actionUrl: '{{ .ConfirmationURL }}' })
//   renderAuthEmail('recovery', { actionUrl: 'https://locastar.se/…' })
//
// That is also why `text` is returned for the auth kinds even though the
// dashboard has nowhere to put it — Supabase templates are HTML-only. It costs
// nothing today and makes a future send_email auth hook a drop-in: the hook
// body becomes about fifteen lines, and these signatures do not change.

import { COPY } from './copy.mjs';
import {
  SITE_URL,
  SUPPORT_EMAIL,
  bandHeader,
  button,
  codeBlock,
  fallbackLink,
  footer,
  heading,
  panel,
  paragraph,
  shell,
  spacer,
  COLORS,
} from './layout.mjs';

/** {name} placeholders, filled from `vars` plus the constants every mail has. */
function fill(template, vars) {
  const all = { siteUrl: SITE_URL, supportEmail: SUPPORT_EMAIL, ...vars };
  return String(template).replace(/\{(\w+)\}/g, (whole, key) =>
    Object.prototype.hasOwnProperty.call(all, key) ? all[key] : whole
  );
}

/** A readable plain-text version of a body paragraph. */
function toText(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&mdash;/g, '—')
    .replace(/&rsquo;/g, '’')
    .replace(/&middot;/g, '·')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Anchors in copy.mjs carry no styling, because a link inside a paragraph and
 * a link inside a danger panel want different colours. Painted here instead.
 */
function paintLinks(html, color) {
  return html.replace(/<a href=/g, '<a style="color:' + color + '" href=');
}

function build(entry, vars) {
  const subject = fill(entry.subject, vars);
  const bodyHtml = entry.body.map((p) => paragraph(paintLinks(fill(p, vars), COLORS.teal)));

  let extras = '';
  if (entry.panel) {
    const inner =
      '<p class="d-text" style="margin:0;font-size:15px;line-height:1.6;color:' +
      COLORS.text + '">' +
      paintLinks(fill(entry.panel.html, vars), COLORS.teal) +
      '</p>';
    extras += spacer(24) + panel(inner, entry.panel.tone);
  }
  if (entry.code) {
    extras += spacer(24) + codeBlock(fill(entry.code, vars));
  }
  // A panel or code block with no CTA under it is the last thing in the card,
  // so it has to carry its own bottom margin or it sits flush on the footer.
  if (extras && !entry.cta) extras += spacer(8);

  let cta = '';
  if (entry.cta) {
    const href = fill(entry.cta.href, vars);
    cta =
      spacer(26) +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
      '<tr><td align="center">' + button(href, entry.cta.label) + '</td></tr></table>' +
      '<div class="d-muted" style="text-align:center">' + fallbackLink(href) + '</div>';
  }

  const card =
    '<tr><td class="d-card d-rule sm-pad" style="background:' + COLORS.card +
    ';border-left:1px solid ' + COLORS.border + ';border-right:1px solid ' + COLORS.border +
    ';padding:36px 44px 34px">' +
    heading(fill(entry.heading, vars)) +
    bodyHtml.join('') +
    extras +
    cta +
    '</td></tr>';

  const html = shell({
    subject,
    preheaderText: fill(entry.preheader, vars),
    body: bandHeader() + card + footer(fill(entry.footnote, vars)),
  });

  const lines = [toText(fill(entry.heading, vars)), ''];
  for (const p of entry.body) lines.push(toText(fill(p, vars)), '');
  if (entry.panel) lines.push(toText(fill(entry.panel.html, vars)), '');
  if (entry.code) lines.push(fill(entry.code, vars), '');
  // toText, because an href carries &amp; for HTML validity and plain text wants &.
  if (entry.cta) lines.push(entry.cta.label + ': ' + toText(fill(entry.cta.href, vars)), '');
  lines.push(toText(fill(entry.footnote, vars)));

  return { subject, html, text: lines.join('\n') };
}

/** Every kind the generator and any future auth hook can render. */
export const AUTH_KINDS = [
  'confirmation',
  'recovery',
  'email_change',
  'magic_link',
  'invite',
  'reauthentication',
  'password_changed',
];

export function renderAuthEmail(kind, vars = {}) {
  const entry = COPY[kind];
  if (!entry) throw new Error('Unknown email kind: ' + kind);
  return build(entry, vars);
}

export function renderAccountDeleted() {
  return build(COPY.account_deleted, {});
}
