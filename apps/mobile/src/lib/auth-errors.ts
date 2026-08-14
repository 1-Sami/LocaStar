/**
 * Supabase auth failures, in the language the app is actually in.
 *
 * Everything else was translated and this was not: the sign-in and sign-up
 * screens took `error.message` straight from the server and printed it. So the
 * front door of a Swedish app answered "Invalid login credentials" — in
 * English, in the voice of a database rather than a product, at the one moment
 * somebody has no idea whether the problem is them or us.
 *
 * Keyed on `error.code`, which auth-js has carried since v2 and which is
 * stable; the message text is not, and matching on it breaks the first time
 * the server rewords something. The exception is the offline case, which has
 * no code at all — see below.
 *
 * Typed structurally rather than against AuthError so this file does not need
 * the supabase package: it reads three fields and has no business knowing more.
 */

type AuthLikeError = {
  code?: string;
  message?: string;
  status?: number;
};

/*
 * Only the codes this app can actually produce.
 *
 * auth-js declares about eighty, but most belong to features LocaStar does not
 * have — MFA, SMS, SAML, OAuth providers, anonymous sign-in. Mapping those
 * would be writing Swedish for situations that cannot arise, and each one
 * would still need checking the day it did.
 */
const KEY_BY_CODE: Record<string, string> = {
  invalid_credentials: 'authError.invalidCredentials',
  email_not_confirmed: 'authError.emailNotConfirmed',
  user_already_exists: 'authError.emailExists',
  email_exists: 'authError.emailExists',
  identity_already_exists: 'authError.emailExists',
  weak_password: 'authError.weakPassword',
  same_password: 'authError.samePassword',
  over_email_send_rate_limit: 'authError.emailRateLimit',
  over_request_rate_limit: 'authError.rateLimit',
  email_address_invalid: 'authError.invalidEmail',
  /*
   * validation_failed is generic, but email format is the only thing it can
   * mean here — probed against the live endpoint, a malformed address comes
   * back as validation_failed ("Unable to validate email address: invalid
   * format") while every password problem comes back as weak_password. There
   * is nothing else the app sends to auth.
   */
  validation_failed: 'authError.invalidEmail',
  signup_disabled: 'authError.signupDisabled',
  email_provider_disabled: 'authError.signupDisabled',
  provider_disabled: 'authError.signupDisabled',
  user_banned: 'authError.userBanned',
  otp_expired: 'authError.linkExpired',
  flow_state_expired: 'authError.linkExpired',
  session_expired: 'authError.sessionExpired',
  session_not_found: 'authError.sessionExpired',
  refresh_token_not_found: 'authError.sessionExpired',
  refresh_token_already_used: 'authError.sessionExpired',
  bad_jwt: 'authError.sessionExpired',
  user_not_found: 'authError.userNotFound',
  reauthentication_needed: 'authError.reauthNeeded',
  reauthentication_not_valid: 'authError.reauthNeeded',
  captcha_failed: 'authError.captcha',
  request_timeout: 'authError.timeout',
  hook_timeout: 'authError.timeout',
  hook_timeout_after_retry: 'authError.timeout',
};

/**
 * A translation key for an auth failure — never a message.
 *
 * Returning the key rather than the finished sentence keeps this file free of
 * `t`, and means a language change re-renders the error along with everything
 * else instead of leaving the last one frozen in the previous language.
 */
export function authErrorKey(error: AuthLikeError | null | undefined): string {
  if (!error) return 'authError.generic';

  const mapped = error.code ? KEY_BY_CODE[error.code] : undefined;
  if (mapped) return mapped;

  /*
   * No connection.
   *
   * AuthRetryableFetchError arrives with no code and status 0, because the
   * request never reached a server that could assign one. Worth separating
   * from the generic case: "check your connection" is something the person can
   * act on, and telling them "something went wrong" while their train is in a
   * tunnel is the kind of thing that gets an app deleted.
   */
  const message = error.message?.toLowerCase() ?? '';
  if (
    error.status === 0 ||
    message.includes('failed to fetch') ||
    message.includes('network request failed')
  ) {
    return 'authError.network';
  }

  // Deliberately logged, not shown. The person gets a sentence they can act on;
  // the original survives in the dev console, which is the only place anybody
  // would go looking for why an unmapped code appeared.
  console.error('Unmapped auth error', error.code, error.message);
  return 'authError.generic';
}
