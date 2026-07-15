import type { SupabaseClient } from "@supabase/supabase-js";

export type LocationList = {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
  createdAt: string;
};

type ListRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  list_items: { count: number }[];
};

export async function fetchLists(client: SupabaseClient, userId: string): Promise<LocationList[]> {
  const { data, error } = await client
    .from("lists")
    .select("id, name, description, created_at, list_items(count)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as ListRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    itemCount: row.list_items?.[0]?.count ?? 0,
    createdAt: row.created_at,
  }));
}

export async function createList(
  client: SupabaseClient,
  userId: string,
  name: string,
  description: string | null
): Promise<string> {
  const { data, error } = await client
    .from("lists")
    .insert({ user_id: userId, name, description })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function deleteList(client: SupabaseClient, listId: string): Promise<void> {
  const { error } = await client.from("lists").delete().eq("id", listId);
  if (error) throw error;
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
  } | null;
};

export async function fetchListItems(client: SupabaseClient, listId: string): Promise<ListItemLocation[]> {
  const { data, error } = await client
    .from("list_items")
    .select(
      "note, location:locations(id, name, description, address, avg_rating, review_count, kind, location_categories(categories(slug)))"
    )
    .eq("list_id", listId)
    .order("added_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as ListItemRow[])
    .filter((row) => row.location !== null)
    .map((row) => ({
      locationId: row.location!.id,
      name: row.location!.name,
      description: row.location!.description,
      address: row.location!.address,
      avgRating: row.location!.avg_rating,
      reviewCount: row.location!.review_count,
      kind: row.location!.kind,
      categorySlug: row.location!.location_categories?.[0]?.categories?.slug ?? null,
      note: row.note,
    }));
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
