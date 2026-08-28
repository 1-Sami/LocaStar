import type { SupabaseClient } from "@supabase/supabase-js";

import { coverPhotoPath } from "./saves";

export type ListPreviewLocation = {
  locationId: string;
  /** Public URL of that location's first photo, null if it has none. */
  imageUrl: string | null;
};

export type LocationList = {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
  createdAt: string;
  isPublic: boolean;
  likeCount: number;
  likedByMe: boolean;
  previewLocations: ListPreviewLocation[];
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

  const [previewByList, likesByList, countByList] = await Promise.all([
    fetchPreviewLocations(client, listIds),
    fetchLikeInfo(client, listIds, userId),
    fetchReadableItemCounts(client, listIds),
  ]);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    itemCount: countByList.get(row.id) ?? 0,
    createdAt: row.created_at,
    isPublic: row.is_public,
    likeCount: likesByList.get(row.id)?.count ?? 0,
    likedByMe: likesByList.get(row.id)?.likedByMe ?? false,
    previewLocations: previewByList.get(row.id) ?? [],
  }));
}

/**
 * The first few locations in each list, with their cover photo.
 *
 * List cards used to render a random stock image per location id; carrying the
 * real photo through means a list looks like the places actually in it.
 */
async function fetchPreviewLocations(
  client: SupabaseClient,
  listIds: string[]
): Promise<Map<string, ListPreviewLocation[]>> {
  const { data, error } = await client
    .from("list_items")
    .select("list_id, location_id, location:locations(location_photos(storage_path, created_at))")
    .in("list_id", listIds)
    .order("added_at", { ascending: false });
  if (error) throw error;

  type PreviewRow = {
    list_id: string;
    location_id: string;
    location: { location_photos: { storage_path: string; created_at: string }[] } | null;
  };

  const byList = new Map<string, ListPreviewLocation[]>();
  for (const row of (data ?? []) as unknown as PreviewRow[]) {
    // An embed that did not resolve is a location this reader cannot open — an
    // activity the retire job marked `past`, or one a moderator removed. It
    // must not take a preview slot and lead nowhere.
    if (row.location === null) continue;
    const existing = byList.get(row.list_id) ?? [];
    if (existing.length < 3) {
      const path = coverPhotoPath(row.location?.location_photos);
      existing.push({
        locationId: row.location_id,
        imageUrl: path ? client.storage.from("media").getPublicUrl(path).data.publicUrl : null,
      });
      byList.set(row.list_id, existing);
    }
  }
  return byList;
}

/**
 * How many items in each list this reader can actually see.
 *
 * `list_items(count)` counts rows, and a row outlives its location becoming
 * unreadable — an activity the retire job marked `past`, or a place a
 * moderator removed. The card said "6 places" over a list that opened showing
 * 5. `!inner` makes PostgREST drop the item when the join does not resolve,
 * so the number matches the screen.
 */
async function fetchReadableItemCounts(
  client: SupabaseClient,
  listIds: string[]
): Promise<Map<string, number>> {
  if (listIds.length === 0) return new Map();
  const { data, error } = await client
    .from("list_items")
    .select("list_id, locations!inner(id)")
    .in("list_id", listIds);
  if (error) throw error;

  const byList = new Map<string, number>();
  for (const row of (data ?? []) as { list_id: string }[]) {
    byList.set(row.list_id, (byList.get(row.list_id) ?? 0) + 1);
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

export type ListMeta = {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  ownerUsername: string | null;
  ownerDisplayName: string | null;
};

type ListMetaRow = {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
  owner: { username: string | null; display_name: string | null } | null;
};

/**
 * Who made a list and how current it is, for the attribution line on the list
 * screen. Kept separate from fetchListItems so opening a list doesn't re-fetch
 * every place just to redraw a byline.
 *
 * Returns null when the list is gone — worth handling, since the nightly
 * cleanup can remove an empty public list out from under an open screen.
 */
export async function fetchListMeta(
  client: SupabaseClient,
  listId: string
): Promise<ListMeta | null> {
  const { data, error } = await client
    .from("lists")
    .select(
      "id, name, description, is_public, created_at, updated_at, user_id, owner:profiles!lists_user_id_fkey(username, display_name)"
    )
    .eq("id", listId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as ListMetaRow;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ownerId: row.user_id,
    ownerUsername: row.owner?.username ?? null,
    ownerDisplayName: row.owner?.display_name ?? null,
  };
}

export type ListReportInput = {
  listId: string;
  reporterId: string;
  reason: string;
  details: string | null;
  /** Filed by a block rather than chosen — see ReviewReportInput.fromBlock. */
  fromBlock?: boolean;
};

/**
 * Reports a list.
 *
 * Lists were the one kind of user-generated content with no report path, even
 * though a public one puts a name and a description written by a stranger on
 * the Home screen. See migration 0122 — the table is a mirror of
 * review_reports, so the moderation queue needed no new shape to show it.
 */
export async function reportList(client: SupabaseClient, input: ListReportInput): Promise<void> {
  const { error } = await client.from("list_reports").insert({
    list_id: input.listId,
    reporter_id: input.reporterId,
    reason: input.reason,
    details: input.details,
    from_block: input.fromBlock ?? false,
  });
  if (error) throw error;
}

export type ListItemLocation = {
  locationId: string;
  name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
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
    city: string | null;
    country: string | null;
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
      "note, location:locations(id, name, description, address, city, country, avg_rating, review_count, kind, location_categories(categories(slug)), location_photos(storage_path))"
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
        city: row.location!.city,
        country: row.location!.country,
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
  /** "sent" = I shared it out, "received" = someone shared it with me. */
  direction: "sent" | "received";
  /** The person at the other end: the recipient if sent, the sender if received. */
  otherPartyUsername: string | null;
  otherPartyDisplayName: string | null;
  /**
   * How many people this list was shared with. Only meaningful when
   * direction is "sent"; 0 for a list someone shared with you.
   */
  recipientCount: number;
};

type SharedListRow = {
  id: string;
  created_at: string;
  sender_id: string;
  sender: { username: string | null; display_name: string | null } | null;
  recipient: { username: string | null; display_name: string | null } | null;
  list: {
    id: string;
    name: string;
    description: string | null;
    list_items: { count: number }[];
  } | null;
};

/**
 * Every list share this user is part of, in both directions — mirroring how
 * shared *locations* already work. Fetching only the received side made a list
 * you shared out invisible to you, so there was no way to see who you had
 * shared with.
 */
export async function fetchMyListShares(client: SupabaseClient, userId: string): Promise<SharedList[]> {
  const { data, error } = await client
    .from("list_shares")
    .select(
      `id, created_at, sender_id,
       sender:profiles!list_shares_sender_id_fkey(username, display_name),
       recipient:profiles!list_shares_recipient_id_fkey(username, display_name),
       list:lists(id, name, description, list_items(count))`
    )
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = ((data ?? []) as unknown as SharedListRow[]).filter((row) => row.list !== null);

  // Same reason as everywhere else a list count is shown: rows outlive the
  // locations they point at, so the count has to come from what is readable.
  const countByList = await fetchReadableItemCounts(
    client,
    rows.map((row) => row.list!.id)
  );

  // One row per share means a list shared with three people appeared three
  // times in your own Shared section. Collapse the sent side to one card per
  // list and count the recipients instead. The received side stays one card
  // per share — those are genuinely separate people sharing with you.
  const sentByList = new Map<string, SharedList>();
  const result: SharedList[] = [];

  for (const row of rows) {
    const sent = row.sender_id === userId;
    const otherParty = sent ? row.recipient : row.sender;
    const entry: SharedList = {
      id: row.list!.id,
      shareId: row.id,
      name: row.list!.name,
      description: row.list!.description,
      itemCount: countByList.get(row.list!.id) ?? 0,
      sharedAt: row.created_at,
      direction: sent ? "sent" : "received",
      otherPartyUsername: otherParty?.username ?? null,
      otherPartyDisplayName: otherParty?.display_name ?? null,
      recipientCount: sent ? 1 : 0,
    };

    if (!sent) {
      result.push(entry);
      continue;
    }

    const existing = sentByList.get(entry.id);
    if (existing) {
      existing.recipientCount += 1;
    } else {
      sentByList.set(entry.id, entry);
      result.push(entry);
    }
  }

  return result;
}

export async function deleteListShare(client: SupabaseClient, shareId: string): Promise<void> {
  const { error } = await client.from("list_shares").delete().eq("id", shareId);
  if (error) throw error;
}

/**
 * Withdraws a list from everyone it was shared with.
 *
 * The Shared section collapses a list you shared into one card, so removing it
 * has to revoke every recipient — deleting a single share would drop the card
 * while other people could still see the list.
 */
export async function stopSharingList(
  client: SupabaseClient,
  listId: string,
  senderId: string
): Promise<void> {
  const { error } = await client
    .from("list_shares")
    .delete()
    .eq("list_id", listId)
    .eq("sender_id", senderId);
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

export type PublicList = LocationList & {
  /**
   * Who wrote it. Carried so a feed can drop the lists of anyone the viewer
   * has blocked — the name alone cannot be matched against a block, which is
   * held by id.
   */
  ownerId: string;
  ownerUsername: string | null;
  ownerDisplayName: string | null;
};

type PublicListRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  is_public: boolean;
  user_id: string;
  list_items: { count: number }[];
  owner: { username: string | null; display_name: string | null } | null;
};

export type PublicListSort = "newest" | "most_liked" | "least_liked";

export async function fetchPublicLists(
  client: SupabaseClient,
  viewerUserId?: string | null,
  sort: PublicListSort = "newest"
): Promise<PublicList[]> {
  const { data, error } = await client
    .from("lists")
    .select(
      "id, name, description, created_at, is_public, user_id, list_items(count), owner:profiles!lists_user_id_fkey(username, display_name)"
    )
    .eq("is_public", true)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as PublicListRow[];
  const listIds = rows.map((row) => row.id);
  if (listIds.length === 0) return [];

  const [previewByList, likesByList, countByList] = await Promise.all([
    fetchPreviewLocations(client, listIds),
    fetchLikeInfo(client, listIds, viewerUserId ?? ""),
    fetchReadableItemCounts(client, listIds),
  ]);

  const lists = rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    itemCount: countByList.get(row.id) ?? 0,
    createdAt: row.created_at,
    isPublic: row.is_public,
    likeCount: likesByList.get(row.id)?.count ?? 0,
    likedByMe: likesByList.get(row.id)?.likedByMe ?? false,
    previewLocations: previewByList.get(row.id) ?? [],
    ownerId: row.user_id,
    ownerUsername: row.owner?.username ?? null,
    ownerDisplayName: row.owner?.display_name ?? null,
  }));

  // Like counts are assembled here rather than in the query, so ordering by
  // them has to happen after mapping. Ties fall back to newest first.
  if (sort === "most_liked" || sort === "least_liked") {
    const direction = sort === "most_liked" ? -1 : 1;
    lists.sort(
      (a, b) =>
        (a.likeCount - b.likeCount) * direction ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  return lists;
}

/* ---------------------------------------------------------- list saves --- */

/**
 * Saving a public list to your own Saved page. Separate from liking: a like is
 * public and shows on the card, a save is private and only changes where the
 * list appears for you.
 */
export async function setListSaved(
  client: SupabaseClient,
  listId: string,
  userId: string,
  saved: boolean
): Promise<void> {
  if (saved) {
    const { error } = await client.from("list_saves").insert({ list_id: listId, user_id: userId });
    if (error) throw error;
  } else {
    const { error } = await client.from("list_saves").delete().match({ list_id: listId, user_id: userId });
    if (error) throw error;
  }
}

export async function fetchListSavedState(
  client: SupabaseClient,
  listId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await client
    .from("list_saves")
    .select("list_id")
    .match({ list_id: listId, user_id: userId })
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

/** The lists this user has saved, for the Saved page. */
export async function fetchSavedLists(client: SupabaseClient, userId: string): Promise<PublicList[]> {
  const { data, error } = await client
    .from("list_saves")
    .select(
      "created_at, lists(id, name, description, created_at, is_public, user_id, list_items(count), owner:profiles!lists_user_id_fkey(username, display_name))"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = ((data ?? []) as unknown as { lists: PublicListRow | null }[])
    .map((row) => row.lists)
    .filter((list): list is PublicListRow => list !== null);
  if (rows.length === 0) return [];

  const listIds = rows.map((row) => row.id);
  const [previewByList, likesByList, countByList] = await Promise.all([
    fetchPreviewLocations(client, listIds),
    fetchLikeInfo(client, listIds, userId),
    fetchReadableItemCounts(client, listIds),
  ]);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    itemCount: countByList.get(row.id) ?? 0,
    createdAt: row.created_at,
    isPublic: row.is_public,
    likeCount: likesByList.get(row.id)?.count ?? 0,
    likedByMe: likesByList.get(row.id)?.likedByMe ?? false,
    previewLocations: previewByList.get(row.id) ?? [],
    ownerId: row.user_id,
    ownerUsername: row.owner?.username ?? null,
    ownerDisplayName: row.owner?.display_name ?? null,
  }));
}
