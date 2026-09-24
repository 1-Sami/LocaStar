import type { SupabaseClient } from "@supabase/supabase-js";

import { EMPTY_COUNTS, type AchievementCounts } from "../achievements";

/**
 * Everything the caller has contributed that still stands.
 *
 * One round trip for the whole screen: the database answers with facts and the
 * arithmetic happens in `achievements.ts`, so moving what a photo is worth
 * never needs a migration. The function is own-account only — there is no way
 * to ask it about somebody else, because nothing in this design compares two
 * people.
 */
export async function fetchMyAchievementCounts(
  client: SupabaseClient
): Promise<AchievementCounts> {
  const { data, error } = await client.rpc("my_achievement_counts");
  if (error) throw error;

  const row = (data ?? {}) as Record<string, unknown>;
  const counts = { ...EMPTY_COUNTS };
  for (const key of Object.keys(EMPTY_COUNTS) as (keyof AchievementCounts)[]) {
    const value = row[key];
    counts[key] = typeof value === "number" ? value : Number(value ?? 0) || 0;
  }
  return counts;
}
