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

export async function fetchSharedLocations(
  client: SupabaseClient,
  recipientId: string
): Promise<SavedLocation[]> {
  const { data, error } = await client
    .from("location_shares")
    .select(`location_id, note, ${JOINED_LOCATION_SELECT}`)
    .eq("recipient_id", recipientId);
  if (error) throw error;

  return (data ?? [])
    .map((row) => mapJoinedLocation(row as unknown as JoinedLocationRow))
    .filter((location): location is SavedLocation => location !== null);
}
