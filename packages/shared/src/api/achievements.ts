import type { SupabaseClient } from "@supabase/supabase-js";

import {
  EMPTY_COUNTS,
  levelFor,
  summarise,
  type AchievementCounts,
  type LevelState,
} from "../achievements";

function toCounts(row: unknown): AchievementCounts {
  const source = (row ?? {}) as Record<string, unknown>;
  const counts = { ...EMPTY_COUNTS };
  for (const key of Object.keys(EMPTY_COUNTS) as (keyof AchievementCounts)[]) {
    const value = source[key];
    counts[key] = typeof value === "number" ? value : Number(value ?? 0) || 0;
  }
  return counts;
}

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
  return toCounts(data);
}

/**
 * The level to show beside other people's names.
 *
 * One round trip for a whole page of reviews rather than one per author. The
 * server caps the list at 40, which is more authors than any place page has.
 *
 * Returns levels, not counts: a badge beside a review is a single word, and
 * handing a screen the raw contribution numbers of everybody on it invites
 * somebody to render them into exactly the comparison this design does not
 * have. A missing id simply has no entry — a failed lookup costs the badge,
 * never the review.
 */
export async function fetchLevelsFor(
  client: SupabaseClient,
  userIds: string[]
): Promise<Map<string, LevelState>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const levels = new Map<string, LevelState>();
  if (unique.length === 0) return levels;

  const { data, error } = await client.rpc("achievement_counts_for", {
    p_user_ids: unique,
  });
  if (error) throw error;

  for (const row of (data ?? []) as { user_id: string; counts: unknown }[]) {
    if (!row?.user_id) continue;
    levels.set(row.user_id, levelFor(summarise(toCounts(row.counts)).points));
  }
  return levels;
}

/** The caller's own level, for the badge under their name. */
export async function fetchMyLevel(client: SupabaseClient): Promise<LevelState> {
  return levelFor(summarise(await fetchMyAchievementCounts(client)).points);
}
