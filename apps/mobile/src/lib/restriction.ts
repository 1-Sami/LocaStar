import { fetchMyActiveBan } from '@locastar/shared';
import type { TFunction } from 'i18next';

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
export async function restrictionMessage(
  userId: string | undefined,
  t: TFunction
): Promise<string | null> {
  if (!userId) return null;

  try {
    const ban = await fetchMyActiveBan(supabase, userId);
    if (!ban) return null;

    // Two whole sentences rather than one with an optional clause spliced into
    // the middle: where "until 3 May" sits in the sentence is not the same in
    // every language, and a fragment cannot be moved.
    return ban.expiresAt
      ? t('validation.restrictedUntil', { date: new Date(ban.expiresAt).toLocaleDateString() })
      : t('validation.restricted');
  } catch {
    // If the check itself fails, say nothing and let the caller fall back to
    // its own message rather than inventing a reason.
    return null;
  }
}

/** The restriction message when there is one, otherwise the caller's own. */
export async function writeFailureMessage(
  userId: string | undefined,
  fallback: string,
  t: TFunction
): Promise<string> {
  return (await restrictionMessage(userId, t)) ?? fallback;
}
