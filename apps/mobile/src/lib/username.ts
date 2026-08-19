import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, USERNAME_PATTERN } from '@locastar/shared';

import type { ValidationProblem } from '@/constants/auth';

export { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH };


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
