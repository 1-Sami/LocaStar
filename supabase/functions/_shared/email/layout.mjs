// The one email layout. Everything a LocaStar user receives is built from this.
//
// Plain .mjs, not .ts, and that is load-bearing: this file is imported by the
// Deno edge functions *and* by the Node generator that writes the static
// templates in supabase/templates/. Both runtimes resolve .mjs natively, and a
// .ts file can import it — a .ts layout would be unreachable from Node without
// adding a fourth toolchain to a repo that already has three.
//
// So: no Deno.*, no node:*, no imports. String building only.

export const COLORS = {
  // Near-black with a green cast rather than a neutral one. That cast is what
  // stops the header reading as a generic dark bar, and it leaves the teal
  // logo tile as the only saturated thing above the fold.
  band: '#141E1D',
  // In dark mode the message card is itself #141E1D, so the band has to lift
  // or it merges into the body with no seam at all. Same hue, one step up.
  bandDark: '#1D2E2C',

  page: '#E4EAE9',
  card: '#FFFFFF',
  foot: '#F5F8F7',
  border: '#E1E7E5',

  teal: '#125F6F',
  ink: '#F4F6F5',
  mint: '#5FD3CF',

  heading: '#16211F',
  text: '#3A4B49',
  muted: '#7A8B89',
  danger: '#E05252',
  dangerInk: '#B03A3A',
  dangerBg: '#FDF4F4',
  dangerBorder: '#F2D8D8',
};

export const LOGO_URL = 'https://locastar.se/email/logo-v1.png';
export const SITE_URL = 'https://locastar.se';
export const SUPPORT_EMAIL = 'support@locastar.se';

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = 'Consolas,Menlo,monospace';

/**
 * For anything that came from a person. The auth templates interpolate only Go
 * placeholders and our own copy, but the feedback digest carries typed text,
 * and one stray angle bracket there mangles the whole message.
 */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The preview line the inbox shows beside the subject.
 *
 * Without one the client invents its own, which is why Outlook currently shows
 * "LocaStar Bekräfta din e-postadress Hej!…" — it had nothing to show, so it
 * repeated the subject. The zero-width joiners afterwards stop Gmail dragging
 * the button label into the preview to fill the remaining space.
 */
export function preheader(text) {
  const pad = '&zwnj;&nbsp;'.repeat(40);
  return (
    '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;' +
    'font-size:1px;line-height:1px;color:#ffffff;opacity:0">' +
    text +
    pad +
    '</div>'
  );
}

/**
 * A button Outlook can actually draw.
 *
 * Outlook Windows ignores padding on an anchor, so without the VML roundrect
 * the CTA renders as a bare blue link. The anchor forces its own white because
 * Gmail's dark mode recolours link text regardless of the inline rule.
 */
export function button(href, label) {
  const radius = 8;
  const arc = Math.round((radius / 48) * 100) + '%';
  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0">' +
    '<tr><td align="center" bgcolor="' + COLORS.teal + '" style="border-radius:' + radius + 'px">' +
    '<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" ' +
    'xmlns:w="urn:schemas-microsoft-com:office:word" href="' + href + '" ' +
    'style="height:48px;v-text-anchor:middle;width:280px" arcsize="' + arc + '" ' +
    'stroke="f" fillcolor="' + COLORS.teal + '"><w:anchorlock/>' +
    '<center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;' +
    'font-weight:bold">' + label + '</center></v:roundrect><![endif]-->' +
    '<!--[if !mso]><!-->' +
    '<a href="' + href + '" style="display:inline-block;padding:14px 30px;' +
    'font-family:' + FONT + ';font-size:16px;font-weight:600;line-height:20px;' +
    'color:#ffffff!important;text-decoration:none;border-radius:' + radius + 'px;' +
    'background:' + COLORS.teal + '">' + label + '</a>' +
    '<!--<![endif]-->' +
    '</td></tr></table>'
  );
}

/** The paste-this-URL line. People do use it, so it stays — quietly. */
export function fallbackLink(href) {
  return (
    '<p style="margin:22px 0 0;font-size:12px;line-height:1.5;color:' + COLORS.muted + '">' +
    'Button not working? Paste this into your browser:<br>' +
    '<span style="color:' + COLORS.muted + ';word-break:break-all">' + href + '</span></p>'
  );
}

/** A bordered callout. `tone` is 'danger' or anything else for neutral. */
export function panel(html, tone) {
  const danger = tone === 'danger';
  const bg = danger ? COLORS.dangerBg : '#F2F6F5';
  const border = danger ? COLORS.dangerBorder : COLORS.border;
  const rule = danger ? 'border-left:3px solid ' + COLORS.danger + ';' : '';
  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td class="d-panel" style="background:' + bg + ';border:1px solid ' + border + ';' +
    rule + 'border-radius:8px;padding:16px 18px">' + html + '</td></tr></table>'
  );
}

/** The code block, for the templates Supabase gives no link at all. */
export function codeBlock(token) {
  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td class="d-code" align="center" style="background:#F2F6F5;border:1px solid ' +
    COLORS.border + ';border-radius:10px;padding:22px 18px">' +
    '<div style="font-family:' + MONO + ';font-size:38px;font-weight:700;' +
    'letter-spacing:10px;color:' + COLORS.teal + ';line-height:1.1">' + token + '</div>' +
    '</td></tr></table>'
  );
}

// Dark rules, authored once as [selector, declarations] and emitted under the
// media query — which is what Apple Mail and Outlook.com honour. Gmail does its
// own thing regardless, which is why nothing below is load-bearing for
// legibility: these rules improve dark mode, they do not rescue it.
const DARK = [
  ['.d-page', 'background:#050A09!important'],
  ['.d-band', 'background:' + COLORS.bandDark + '!important'],
  ['.d-card', 'background:#141E1D!important;border-color:#2A3736!important'],
  ['.d-h1', 'color:#EAF0EF!important'],
  ['.d-text', 'color:#BFCECC!important'],
  ['.d-muted', 'color:#8CA09D!important'],
  ['.d-muted p, .d-muted span', 'color:#8CA09D!important'],
  ['.d-rule', 'border-color:#2A3736!important'],
  ['.d-foot', 'background:#0E1817!important;border-color:#2A3736!important'],
  // The danger panel keeps its red rule but loses the pink wash, which inverts
  // to an unreadable maroon.
  ['.d-panel', 'background:#1B1413!important;border-color:#402A2A!important'],
  ['.d-panel strong', 'color:#F09A9A!important'],
  ['.d-code', 'background:#0E1817!important;border-color:#2A3736!important'],
  ['.d-code div', 'color:#7FD6D2!important'],
];

function darkRules() {
  return DARK.map((rule) => rule[0] + '{' + rule[1] + '}').join('');
}

/**
 * Wraps body rows in the full document.
 *
 * Table-based, 600px, every style inline. Both the width attribute and
 * max-width, because Outlook reads one and everything else reads the other.
 */
export function shell({ subject, preheaderText, body }) {
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light dark">' +
    '<meta name="supported-color-schemes" content="light dark">' +
    '<title>' + subject + '</title><style>' +
    'body{-webkit-text-size-adjust:100%;margin:0;padding:0}' +
    'table{border-collapse:collapse}' +
    'td{mso-line-height-rule:exactly}' +
    '@media (max-width:620px){.sm-pad{padding-left:22px!important;' +
    'padding-right:22px!important}.sm-full{width:100%!important}}' +
    '@media (prefers-color-scheme:dark){' + darkRules() + '}' +
    '</style></head>' +
    '<body class="d-page" style="margin:0;padding:0;background:' + COLORS.page +
    ';font-family:' + FONT + '">' +
    preheader(preheaderText) +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
    'class="d-page" style="background:' + COLORS.page + '">' +
    '<tr><td align="center" style="padding:32px 12px 40px">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" ' +
    'class="sm-full" style="width:600px;max-width:600px">' +
    body +
    '</table></td></tr></table></body></html>'
  );
}

/**
 * The band. bgcolor is repeated as an attribute because Outlook ignores the
 * background shorthand on a td, and the logo is an opaque tile for the reason
 * documented in apps/mobile/scripts/generate-email-logo.mjs.
 */
export function bandHeader() {
  return (
    '<tr><td align="center" bgcolor="' + COLORS.band + '" class="d-band" ' +
    'style="background:' + COLORS.band + ';border-radius:12px 12px 0 0;padding:26px 24px 24px">' +
    '<img src="' + LOGO_URL + '" width="56" height="56" alt="LocaStar" ' +
    'style="display:block;border:0;border-radius:14px;width:56px;height:56px;margin:0 auto 11px">' +
    '<div style="font-size:17px;font-weight:700;letter-spacing:3px;color:' + COLORS.ink +
    ';line-height:1.2">LOCASTAR</div>' +
    '<div style="font-family:' + MONO + ';font-size:10px;letter-spacing:2.4px;color:' +
    COLORS.mint + ';margin-top:7px">EXPLORE. MAP. SHARE.</div>' +
    '</td></tr>'
  );
}

export function footer(footnote) {
  return (
    '<tr><td class="d-foot d-rule sm-pad" style="background:' + COLORS.foot + ';' +
    'border:1px solid ' + COLORS.border +
    ';border-top:0;border-radius:0 0 12px 12px;padding:22px 44px 24px">' +
    '<p class="d-muted" style="margin:0 0 9px;font-size:13px;line-height:1.55;color:' +
    COLORS.muted + '">' + footnote + '</p>' +
    '<p class="d-muted" style="margin:0;font-size:13px;color:' + COLORS.muted +
    '">LocaStar &middot; ' +
    '<a href="' + SITE_URL + '" style="color:' + COLORS.teal +
    ';text-decoration:none">locastar.se</a> &middot; ' +
    '<a href="mailto:' + SUPPORT_EMAIL + '" style="color:' + COLORS.teal +
    ';text-decoration:none">' + SUPPORT_EMAIL + '</a></p>' +
    '</td></tr>'
  );
}

export function heading(text) {
  return (
    '<h1 class="d-h1" style="margin:0 0 16px;font-size:23px;line-height:1.3;' +
    'font-weight:600;color:' + COLORS.heading + '">' + text + '</h1>'
  );
}

export function paragraph(html) {
  return (
    '<p class="d-text" style="margin:0 0 15px;font-size:16px;line-height:1.62;' +
    'color:' + COLORS.text + '">' + html + '</p>'
  );
}

export function spacer(px) {
  return '<div style="height:' + px + 'px;line-height:' + px + 'px;font-size:0">&nbsp;</div>';
}
