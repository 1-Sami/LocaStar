import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Records this device as somewhere to send push notifications.
 *
 * Goes through the register_device_token RPC rather than writing the table
 * directly, and the table has no insert or update policy at all. The reason is
 * the shared phone: sign out, hand it over, and Expo returns the identical
 * token to the next person, because it belongs to the install and not to the
 * account. An upsert under RLS would then have to update a row somebody else
 * owns and would be refused — leaving the previous owner's notifications
 * arriving on a device that is no longer theirs. The function sets user_id from
 * auth.uid() and never from an argument, so the only thing a caller can say is
 * "this device is mine". See migration 0091.
 */
export async function registerDeviceToken(
  client: SupabaseClient,
  token: string,
  platform: "ios" | "android"
): Promise<void> {
  const { error } = await client.rpc("register_device_token", {
    p_token: token,
    p_platform: platform,
  });
  if (error) throw error;
}

/**
 * Forgets this device, so signing out stops the notifications too.
 *
 * Delete is the one write the owner may do directly — that policy exists.
 */
export async function forgetDeviceToken(
  client: SupabaseClient,
  token: string
): Promise<void> {
  const { error } = await client.from("device_tokens").delete().eq("token", token);
  if (error) throw error;
}
