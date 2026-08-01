import type { SupabaseClient } from "@supabase/supabase-js";

export type BlockedUser = {
  blockId: string;
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

type BlockRow = {
  id: string;
  blocked_id: string;
  created_at: string;
  blocked: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

const BLOCK_SELECT =
  "id, blocked_id, created_at, blocked:profiles!user_blocks_blocked_id_fkey(username, display_name, avatar_url)";

/**
 * Everyone the signed-in user has blocked.
 *
 * Only ever your own: the RLS policy is `blocker_id = auth.uid()`, so there is
 * no query shape that shows you who has blocked *you*.
 */
export async function fetchBlockedUsers(
  client: SupabaseClient,
  userId: string
): Promise<BlockedUser[]> {
  const { data, error } = await client
    .from("user_blocks")
    .select(BLOCK_SELECT)
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as BlockRow[]).map((row) => ({
    blockId: row.id,
    userId: row.blocked_id,
    username: row.blocked?.username ?? null,
    displayName: row.blocked?.display_name ?? null,
    avatarUrl: row.blocked?.avatar_url ?? null,
    createdAt: row.created_at,
  }));
}

/**
 * Blocks someone. A database trigger also tears down any friendship or pending
 * request between the two, so this is the only call the caller needs.
 *
 * Blocking is idempotent — the unique constraint means a second attempt is a
 * no-op rather than an error, which matters because the button can be tapped
 * twice.
 */
export async function blockUser(
  client: SupabaseClient,
  userId: string,
  targetUserId: string
): Promise<void> {
  const { error } = await client
    .from("user_blocks")
    .upsert({ blocker_id: userId, blocked_id: targetUserId }, { onConflict: "blocker_id,blocked_id" });
  if (error) throw error;
}

export async function unblockUser(client: SupabaseClient, blockId: string): Promise<void> {
  const { error } = await client.from("user_blocks").delete().eq("id", blockId);
  if (error) throw error;
}
