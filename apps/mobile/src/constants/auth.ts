/**
 * Must stay in sync with the Supabase Auth "Minimum password length" setting
 * (Authentication → Sign In / Providers → Email). If the client allows a
 * shorter password than the server, sign-up fails with a raw API error instead
 * of useful inline validation.
 *
 * Supabase is additionally set to require letters and digits.
 */
export const MIN_PASSWORD_LENGTH = 8;
