/**
 * Must stay in sync with the Supabase Auth "Minimum password length" setting
 * (Authentication → Sign In / Providers → Email). If the client allows a
 * shorter password than the server, sign-up fails with a raw API error instead
 * of useful inline validation.
 *
 * Supabase is additionally set to require letters and digits.
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Null when the password is acceptable, otherwise the reason it isn't — shown
 * as an inline error once the person starts typing, rather than as a rule
 * listed up front.
 *
 * Mirrors the server's rules so a rejection surfaces here as plain language
 * instead of coming back from the API as a raw error after submitting.
 */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Use both letters and digits.';
  }
  return null;
}

/*
 * Misspellings of the domains almost everybody uses, and of ".com" itself.
 *
 * A tester signed up as `…@hotmail.comm` on the first day of the closed test.
 * The address passed validation — it has an @ and a dot, which is all a regex
 * can honestly check — so the account was created, the confirmation mail hard
 * bounced, and from their side the app simply never sent anything. There is no
 * way to recover: they cannot confirm, cannot sign in, and nothing tells them
 * why.
 *
 * That failure is silent and total, which is what earns a special case. Only
 * strings that cannot be real are listed: `.comm` and `.con` are not TLDs, and
 * nobody owns `gmial.com`. Anything genuinely unusual is left alone, because
 * refusing a valid address is the worse mistake of the two.
 */
const DOMAIN_TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmil.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gnail.com': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmall.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'yahooo.com': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'iclod.com': 'icloud.com',
  'icloud.co': 'icloud.com',
};

/** Endings that are not TLDs, whatever the domain in front of them. */
const TLD_TYPOS: Record<string, string> = {
  comm: 'com',
  con: 'com',
  cmo: 'com',
  ocm: 'com',
  xom: 'com',
  vom: 'com',
  cpm: 'com',
  couk: 'co.uk',
  se1: 'se',
};

/**
 * The address they probably meant, or null when there is nothing to suggest.
 *
 * Returns the corrected address rather than a sentence so the screen can put it
 * inside a translated string, and offer it as something to tap.
 */
export function emailTypoSuggestion(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at < 1 || at === trimmed.length - 1) return null;

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);

  const wholeDomain = DOMAIN_TYPOS[domain];
  if (wholeDomain) return `${local}@${wholeDomain}`;

  const lastDot = domain.lastIndexOf('.');
  if (lastDot === -1) return null;
  const tld = domain.slice(lastDot + 1);
  const fixedTld = TLD_TYPOS[tld];
  if (fixedTld) return `${local}@${domain.slice(0, lastDot)}.${fixedTld}`;

  return null;
}
