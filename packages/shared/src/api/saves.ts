import type { SupabaseClient } from "@supabase/supabase-js";

export type SaveKind = "favorite" | "bucket_list";

export async function fetchSavedLocationIds(
  client: SupabaseClient,
  userId: string,
  kind: SaveKind
): Promise<Set<string>> {
  const { data, error } = await client
    .from("saves")
    .select("location_id")
    .eq("user_id", userId)
    .eq("kind", kind);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.location_id as string));
}

export async function setSaved(
  client: SupabaseClient,
  userId: string,
  locationId: string,
  kind: SaveKind,
  saved: boolean
): Promise<void> {
  if (saved) {
    const { error } = await client
      .from("saves")
      .insert({ user_id: userId, location_id: locationId, kind });
    if (error) throw error;
  } else {
    const { error } = await client
      .from("saves")
      .delete()
      .match({ user_id: userId, location_id: locationId, kind });
    if (error) throw error;
  }
}

export type SavedLocation = {
  location_id: string;
  name: string;
  description: string | null;
  address: string | null;
  avg_rating: number;
  review_count: number;
  kind: "place" | "activity";
  category_slug: string | null;
};

const JOINED_LOCATION_SELECT =
  "location:locations(id, name, description, address, avg_rating, review_count, kind, location_categories(categories(slug)))";

type JoinedLocationRow = {
  location: {
    id: string;
    name: string;
    description: string | null;
    address: string | null;
    avg_rating: number;
    review_count: number;
    kind: "place" | "activity";
    location_categories: { categories: { slug: string } | null }[];
  } | null;
};

function mapJoinedLocation(row: JoinedLocationRow): SavedLocation | null {
  const location = row.location;
  if (!location) return null;
  return {
    location_id: location.id,
    name: location.name,
    description: location.description,
    address: location.address,
    avg_rating: location.avg_rating,
    review_count: location.review_count,
    kind: location.kind,
    category_slug: location.location_categories?.[0]?.categories?.slug ?? null,
  };
}

export async function fetchSavedLocations(
  client: SupabaseClient,
  userId: string,
  kind: SaveKind
): Promise<SavedLocation[]> {
  const { data, error } = await client
    .from("saves")
    .select(`location_id, ${JOINED_LOCATION_SELECT}`)
    .eq("user_id", userId)
    .eq("kind", kind);
  if (error) throw error;

  return (data ?? [])
    .map((row) => mapJoinedLocation(row as unknown as JoinedLocationRow))
    .filter((location): location is SavedLocation => location !== null);
}

export type LocationShare = SavedLocation & {
  shareId: string;
  createdAt: string;
  direction: "sent" | "received";
  otherPartyUsername: string | null;
  otherPartyDisplayName: string | null;
};

type LocationShareRow = JoinedLocationRow & {
  id: string;
  created_at: string;
  sender_id: string;
  recipient_id: string;
  sender: { username: string | null; display_name: string | null } | null;
  recipient: { username: string | null; display_name: string | null } | null;
};

export async function fetchMyShares(client: SupabaseClient, userId: string): Promise<LocationShare[]> {
  const { data, error } = await client
    .from("location_shares")
    .select(
      `id, created_at, sender_id, recipient_id, ${JOINED_LOCATION_SELECT},
       sender:profiles!location_shares_sender_id_fkey(username, display_name),
       recipient:profiles!location_shares_recipient_id_fkey(username, display_name)`
    )
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const base = mapJoinedLocation(row as unknown as JoinedLocationRow);
      if (!base) return null;
      const typedRow = row as unknown as LocationShareRow;
      const direction: "sent" | "received" = typedRow.sender_id === userId ? "sent" : "received";
      const otherParty = direction === "sent" ? typedRow.recipient : typedRow.sender;
      return {
        ...base,
        shareId: typedRow.id,
        createdAt: typedRow.created_at,
        direction,
        otherPartyUsername: otherParty?.username ?? null,
        otherPartyDisplayName: otherParty?.display_name ?? null,
      };
    })
    .filter((share): share is LocationShare => share !== null);
}

export async function deleteShare(client: SupabaseClient, shareId: string): Promise<void> {
  const { error } = await client.from("location_shares").delete().eq("id", shareId);
  if (error) throw error;
}

export type ShareCandidate = {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

export async function searchShareCandidates(
  client: SupabaseClient,
  query: string,
  excludeUserId: string
): Promise<ShareCandidate[]> {
  const { data, error } = await client.rpc("search_share_candidates", {
    search_query: query,
    exclude_user_id: excludeUserId,
  });
  if (error) throw error;

  type CandidateRow = { id: string; username: string | null; display_name: string | null; avatar_url: string | null };

  return ((data ?? []) as CandidateRow[]).map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  }));
}

export type ShareLocationInput = {
  locationId: string;
  senderId: string;
  recipientId: string;
  note: string | null;
};

export async function shareLocation(client: SupabaseClient, input: ShareLocationInput): Promise<void> {
  const { error } = await client.from("location_shares").insert({
    location_id: input.locationId,
    sender_id: input.senderId,
    recipient_id: input.recipientId,
    note: input.note,
  });
  if (error) throw error;
}
