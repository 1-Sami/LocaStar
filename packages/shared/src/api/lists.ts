import type { SupabaseClient } from "@supabase/supabase-js";

export type LocationList = {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
  createdAt: string;
  isPublic: boolean;
  likeCount: number;
  likedByMe: boolean;
  previewLocationIds: string[];
};

type ListRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  is_public: boolean;
  list_items: { count: number }[];
};

export async function fetchLists(client: SupabaseClient, userId: string): Promise<LocationList[]> {
  const { data, error } = await client
    .from("lists")
    .select("id, name, description, created_at, is_public, list_items(count)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as ListRow[];
  const listIds = rows.map((row) => row.id);
  if (listIds.length === 0) return [];

  const [previewByList, likesByList] = await Promise.all([
    fetchPreviewLocationIds(client, listIds),
    fetchLikeInfo(client, listIds, userId),
  ]);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    itemCount: row.list_items?.[0]?.count ?? 0,
    createdAt: row.created_at,
    isPublic: row.is_public,
    likeCount: likesByList.get(row.id)?.count ?? 0,
    likedByMe: likesByList.get(row.id)?.likedByMe ?? false,
    previewLocationIds: previewByList.get(row.id) ?? [],
  }));
}

async function fetchPreviewLocationIds(
  client: SupabaseClient,
  listIds: string[]
): Promise<Map<string, string[]>> {
  const { data, error } = await client
    .from("list_items")
    .select("list_id, location_id")
    .in("list_id", listIds)
    .order("added_at", { ascending: false });
  if (error) throw error;

  const byList = new Map<string, string[]>();
  for (const row of (data ?? []) as { list_id: string; location_id: string }[]) {
    const existing = byList.get(row.list_id) ?? [];
    if (existing.length < 3) {
      existing.push(row.location_id);
      byList.set(row.list_id, existing);
    }
  }
  return byList;
}

async function fetchLikeInfo(
  client: SupabaseClient,
  listIds: string[],
  userId: string
): Promise<Map<string, { count: number; likedByMe: boolean }>> {
  const { data, error } = await client.from("list_likes").select("list_id, user_id").in("list_id", listIds);
  if (error) throw error;

  const byList = new Map<string, { count: number; likedByMe: boolean }>();
  for (const row of (data ?? []) as { list_id: string; user_id: string }[]) {
    const existing = byList.get(row.list_id) ?? { count: 0, likedByMe: false };
    existing.count += 1;
    if (row.user_id === userId) existing.likedByMe = true;
    byList.set(row.list_id, existing);
  }
  return byList;
}

export async function createList(
  client: SupabaseClient,
  userId: string,
  name: string,
  description: string | null,
  isPublic = false
): Promise<string> {
  const { data, error } = await client
    .from("lists")
    .insert({ user_id: userId, name, description, is_public: isPublic })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function deleteList(client: SupabaseClient, listId: string): Promise<void> {
  const { error } = await client.from("lists").delete().eq("id", listId);
  if (error) throw error;
}

export async function renameList(client: SupabaseClient, listId: string, name: string): Promise<void> {
  const { error } = await client.from("lists").update({ name }).eq("id", listId);
  if (error) throw error;
}

export async function setListVisibility(
  client: SupabaseClient,
  listId: string,
  isPublic: boolean
): Promise<void> {
  const { error } = await client.from("lists").update({ is_public: isPublic }).eq("id", listId);
  if (error) throw error;
}

export async function setListLiked(
  client: SupabaseClient,
  listId: string,
  userId: string,
  liked: boolean
): Promise<void> {
  if (liked) {
    const { error } = await client.from("list_likes").insert({ list_id: listId, user_id: userId });
    if (error) throw error;
  } else {
    const { error } = await client.from("list_likes").delete().match({ list_id: listId, user_id: userId });
    if (error) throw error;
  }
}

export type ListItemLocation = {
  locationId: string;
  name: string;
  description: string | null;
  address: string | null;
  avgRating: number;
  reviewCount: number;
  kind: "place" | "activity";
  categorySlug: string | null;
  note: string | null;
  imageUrl: string | null;
};

type ListItemRow = {
  note: string | null;
  location: {
    id: string;
    name: string;
    description: string | null;
    address: string | null;
    avg_rating: number;
    review_count: number;
    kind: "place" | "activity";
    location_categories: { categories: { slug: string } | null }[];
    location_photos: { storage_path: string }[];
  } | null;
};

export async function fetchListItems(client: SupabaseClient, listId: string): Promise<ListItemLocation[]> {
  const { data, error } = await client
    .from("list_items")
    .select(
      "note, location:locations(id, name, description, address, avg_rating, review_count, kind, location_categories(categories(slug)), location_photos(storage_path))"
    )
    .eq("list_id", listId)
    .order("added_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as ListItemRow[])
    .filter((row) => row.location !== null)
    .map((row) => {
      const firstPhotoPath = row.location!.location_photos?.[0]?.storage_path ?? null;
      return {
        locationId: row.location!.id,
        name: row.location!.name,
        description: row.location!.description,
        address: row.location!.address,
        avgRating: row.location!.avg_rating,
        reviewCount: row.location!.review_count,
        kind: row.location!.kind,
        categorySlug: row.location!.location_categories?.[0]?.categories?.slug ?? null,
        note: row.note,
        imageUrl: firstPhotoPath ? client.storage.from("media").getPublicUrl(firstPhotoPath).data.publicUrl : null,
      };
    });
}

export async function addLocationToList(
  client: SupabaseClient,
  listId: string,
  locationId: string
): Promise<void> {
  const { error } = await client
    .from("list_items")
    .insert({ list_id: listId, location_id: locationId });
  if (error) throw error;
}

export async function removeLocationFromList(
  client: SupabaseClient,
  listId: string,
  locationId: string
): Promise<void> {
  const { error } = await client
    .from("list_items")
    .delete()
    .match({ list_id: listId, location_id: locationId });
  if (error) throw error;
}

export async function shareList(
  client: SupabaseClient,
  listId: string,
  senderId: string,
  recipientId: string
): Promise<void> {
  const { error } = await client
    .from("list_shares")
    .insert({ list_id: listId, sender_id: senderId, recipient_id: recipientId });
  if (error) throw error;
}

export type ListShareRecipient = {
  shareId: string;
  recipientUsername: string | null;
  recipientDisplayName: string | null;
};

type ListShareRecipientRow = {
  id: string;
  recipient: { username: string | null; display_name: string | null } | null;
};

export async function fetchListShareRecipients(
  client: SupabaseClient,
  listId: string
): Promise<ListShareRecipient[]> {
  const { data, error } = await client
    .from("list_shares")
    .select("id, recipient:profiles!list_shares_recipient_id_fkey(username, display_name)")
    .eq("list_id", listId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as ListShareRecipientRow[]).map((row) => ({
    shareId: row.id,
    recipientUsername: row.recipient?.username ?? null,
    recipientDisplayName: row.recipient?.display_name ?? null,
  }));
}

export type SharedList = {
  id: string;
  shareId: string;
  name: string;
  description: string | null;
  itemCount: number;
  sharedAt: string;
  senderUsername: string | null;
  senderDisplayName: string | null;
};

type SharedListRow = {
  id: string;
  created_at: string;
  sender: { username: string | null; display_name: string | null } | null;
  list: {
    id: string;
    name: string;
    description: string | null;
    list_items: { count: number }[];
  } | null;
};

export async function fetchListsSharedWithMe(client: SupabaseClient, userId: string): Promise<SharedList[]> {
  const { data, error } = await client
    .from("list_shares")
    .select(
      `id, created_at,
       sender:profiles!list_shares_sender_id_fkey(username, display_name),
       list:lists(id, name, description, list_items(count))`
    )
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as SharedListRow[])
    .filter((row) => row.list !== null)
    .map((row) => ({
      id: row.list!.id,
      shareId: row.id,
      name: row.list!.name,
      description: row.list!.description,
      itemCount: row.list!.list_items?.[0]?.count ?? 0,
      sharedAt: row.created_at,
      senderUsername: row.sender?.username ?? null,
      senderDisplayName: row.sender?.display_name ?? null,
    }));
}

export async function deleteListShare(client: SupabaseClient, shareId: string): Promise<void> {
  const { error } = await client.from("list_shares").delete().eq("id", shareId);
  if (error) throw error;
}

export async function fetchListMembershipForLocation(
  client: SupabaseClient,
  userId: string,
  locationId: string
): Promise<Set<string>> {
  const { data, error } = await client
    .from("list_items")
    .select("list_id, lists!inner(user_id)")
    .eq("location_id", locationId)
    .eq("lists.user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.list_id as string));
}
