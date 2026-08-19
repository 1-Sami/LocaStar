/*
 * The username rule, mirroring the profiles_username_format_check constraint
 * in the database.
 *
 * Only the rule lives here, not the wording: the app returns a translation key
 * and the website writes a sentence, but both have to agree with the database
 * or a bad handle comes back as a raw constraint violation after the account
 * already exists.
 */

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

export const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,19}$/;

/** Whether the handle satisfies the database constraint. */
export function isValidUsername(username: string): boolean {
  return (
    username.length >= USERNAME_MIN_LENGTH &&
    username.length <= USERNAME_MAX_LENGTH &&
    USERNAME_PATTERN.test(username)
  );
}
