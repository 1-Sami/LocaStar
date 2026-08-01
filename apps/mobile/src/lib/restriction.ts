import { fetchMyActiveBan } from '@locastar/shared';

import { supabase } from '@/lib/supabase';

/**
 * An accurate message when a write was refused because the account is
 * restricted, or null when it wasn't.
 *
 * Every write path used to answer a refusal with "Something went wrong. Try
 * again." — which, for a restricted account, is false twice over: nothing went
 * wrong, and trying again will never work. The restriction is enforced in the
 * database (`not is_banned()` on the INSERT and UPDATE policies), so the app
 * only finds out by being told no.
 *
 * This asks the database rather than pattern-matching the error, because a
 * refusal arrives as a bare permission error that a restriction, a missing
 * grant and an ordinary policy miss all share. Checking the ban directly is
 * the only way to say something true. It costs one request, and only on a
 * path that has already failed.
 *
 * Wording is kept in step with the restriction notice on the Profile tab,
 * which is where the reason and the appeal link live.
 */
export async function restrictionMessage(userId: string | undefined): Promise<string | null> {
  if (!userId) return null;

  try {
    const ban = await fetchMyActiveBan(supabase, userId);
    if (!ban) return null;

    const until = ban.expiresAt
      ? ` until ${new Date(ban.expiresAt).toLocaleDateString()}`
      : '';
    return `Your account is restricted${until}, so this can't be posted. See your Profile for the reason and how to appeal.`;
  } catch {
    // If the check itself fails, say nothing and let the caller fall back to
    // its own message rather than inventing a reason.
    return null;
  }
}

/** The restriction message when there is one, otherwise the caller's own. */
export async function writeFailureMessage(
  userId: string | undefined,
  fallback: string
): Promise<string> {
  return (await restrictionMessage(userId)) ?? fallback;
}
