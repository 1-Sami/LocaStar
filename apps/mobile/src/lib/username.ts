export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

/**
 * Mirrors the profiles_username_format_check constraint in the database, so a
 * bad handle is caught inline rather than coming back as a raw constraint
 * violation after submitting.
 */
const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,19}$/;

/** Null when the handle is acceptable, otherwise the reason it isn't. */
export function usernameProblem(username: string): string | null {
  if (username.length < USERNAME_MIN_LENGTH) {
    return `Use at least ${USERNAME_MIN_LENGTH} characters.`;
  }
  if (username.length > USERNAME_MAX_LENGTH) {
    return `Use at most ${USERNAME_MAX_LENGTH} characters.`;
  }
  if (!USERNAME_PATTERN.test(username)) {
    return 'Use letters, digits, dots, dashes or underscores, starting with a letter or digit.';
  }
  return null;
}
