import type { SupabaseClient } from "@supabase/supabase-js";

export type FriendStatus = "pending" | "accepted";
export type FriendDirection = "incoming" | "outgoing";

export type Friend = {
  friendshipId: string;
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  status: FriendStatus;
  direction: FriendDirection;
  createdAt: string;
};

type FriendshipRow = {
  id: string;
  status: FriendStatus;
  requester_id: string;
  recipient_id: string;
  created_at: string;
  requester: { id: string; username: string | null; display_name: string | null; avatar_url: string | null } | null;
  recipient: { id: string; username: string | null; display_name: string | null; avatar_url: string | null } | null;
};

const FRIENDSHIP_SELECT = `id, status, requester_id, recipient_id, created_at,
  requester:profiles!friendships_requester_id_fkey(id, username, display_name, avatar_url),
  recipient:profiles!friendships_recipient_id_fkey(id, username, display_name, avatar_url)`;

export async function fetchFriendships(client: SupabaseClient, userId: string): Promise<Friend[]> {
  const { data, error } = await client
    .from("friendships")
    .select(FRIENDSHIP_SELECT)
    .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as FriendshipRow[]).map((row) => {
    const isRequester = row.requester_id === userId;
    const other = isRequester ? row.recipient : row.requester;
    return {
      friendshipId: row.id,
      userId: isRequester ? row.recipient_id : row.requester_id,
      username: other?.username ?? null,
      displayName: other?.display_name ?? null,
      avatarUrl: other?.avatar_url ?? null,
      status: row.status,
      direction: isRequester ? "outgoing" : "incoming",
      createdAt: row.created_at,
    };
  });
}

export async function sendFriendRequest(
  client: SupabaseClient,
  userId: string,
  targetUserId: string
): Promise<void> {
  const { data: reverse, error: reverseError } = await client
    .from("friendships")
    .select("id, status")
    .eq("requester_id", targetUserId)
    .eq("recipient_id", userId)
    .maybeSingle();
  if (reverseError) throw reverseError;

  if (reverse) {
    if ((reverse as { status: FriendStatus }).status === "pending") {
      const { error } = await client
        .from("friendships")
        .update({ status: "accepted", responded_at: new Date().toISOString() })
        .eq("id", (reverse as { id: string }).id);
      if (error) throw error;
    }
    return;
  }

  const { error } = await client
    .from("friendships")
    .insert({ requester_id: userId, recipient_id: targetUserId, status: "pending" });
  if (error) throw error;
}

export async function acceptFriendRequest(client: SupabaseClient, friendshipId: string): Promise<void> {
  const { error } = await client
    .from("friendships")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", friendshipId);
  if (error) throw error;
}

export async function removeFriendship(client: SupabaseClient, friendshipId: string): Promise<void> {
  const { error } = await client.from("friendships").delete().eq("id", friendshipId);
  if (error) throw error;
}
