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
