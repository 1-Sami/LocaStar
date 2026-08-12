import type { ValidationProblem } from '@/constants/auth';

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

/**
 * Mirrors the profiles_username_format_check constraint in the database, so a
 * bad handle is caught inline rather than coming back as a raw constraint
 * violation after submitting.
 */
const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,19}$/;

/**
 * What is wrong with the handle, as something the caller can translate — or
 * null when it is acceptable. See passwordProblem for why this returns a key.
 */
export function usernameProblem(username: string): ValidationProblem | null {
  if (username.length < USERNAME_MIN_LENGTH) {
    return { key: 'validation.usernameTooShort', params: { count: USERNAME_MIN_LENGTH } };
  }
  if (username.length > USERNAME_MAX_LENGTH) {
    return { key: 'validation.usernameTooLong', params: { count: USERNAME_MAX_LENGTH } };
  }
  if (!USERNAME_PATTERN.test(username)) {
    return { key: 'validation.usernameFormat' };
  }
  return null;
}
