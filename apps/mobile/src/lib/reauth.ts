import { supabase } from '@/lib/supabase';

/**
 * Confirms the signed-in user actually knows their password before a sensitive
 * change (changing the account email or password).
 *
 * Supabase has no dedicated re-authentication call, so this re-runs the password
 * grant for the same account. That refreshes the existing session rather than
 * starting a different one, so the user stays logged in either way.
 */
export async function verifyCurrentPassword(email: string, password: string): Promise<boolean> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return !error;
}
