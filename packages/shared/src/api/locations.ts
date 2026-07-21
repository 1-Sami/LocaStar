import type { SupabaseClient } from "@supabase/supabase-js";

export type LocationKind = "place" | "activity";
export type LocationVisibility = "public" | "private";

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type OpeningHours = Partial<Record<DayKey, { open: string; close: string }>>;

export type NearbyLocation = {
  id: string;
  kind: LocationKind;
  name: string;
  description: string | null;
  address: string | null;
  distance_m: number;
  avg_rating: number;
  review_count: number;
  category_slug: string | null;
  category_label: string | null;
};

export type NearbyLocationsParams = {
  lat: number;
  lng: number;
  radiusM?: number;
  categorySlugs?: string[] | null;
  searchQuery?: string | null;
  sort?: "distance" | "rating";
};

export async function fetchNearbyLocations(
  client: SupabaseClient,
  params: NearbyLocationsParams
): Promise<NearbyLocation[]> {
  const { data, error } = await client.rpc("nearby_locations", {
    lat: params.lat,
    lng: params.lng,
    radius_m: params.radiusM ?? 50000,
    category_slugs: params.categorySlugs && params.categorySlugs.length > 0 ? params.categorySlugs : null,
    search_query: params.searchQuery ?? null,
    sort: params.sort ?? "distance",
  });
  if (error) throw error;
  return (data ?? []) as NearbyLocation[];
}

export type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
};

export async function fetchCategories(client: SupabaseClient): Promise<Category[]> {
  const { data, error } = await client
    .from("categories")
    .select("id,name,slug,icon")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Category[];
}

export type LocationDetail = {
  id: string;
  kind: LocationKind;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  hours: OpeningHours | null;
  avg_rating: number;
  review_count: number;
  category_slug: string | null;
  category_label: string | null;
  created_by: string | null;
  creator_username: string | null;
  creator_visible: boolean;
  visibility: LocationVisibility;
  expires_at: string | null;
  is_boosted: boolean;
  is_verified: boolean;
  claimed_by: string | null;
  owner_username: string | null;
};

type LocationDetailRow = {
  id: string;
  kind: LocationKind;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  hours: OpeningHours | null;
  avg_rating: number;
  review_count: number;
  created_by: string | null;
  creator: { username: string | null } | null;
  creator_visible: boolean;
  visibility: LocationVisibility;
  expires_at: string | null;
  is_boosted: boolean;
  is_verified: boolean;
  claimed_by: string | null;
  owner: { username: string | null } | null;
  location_categories: { categories: { slug: string; name: string } | null }[];
};

export type LocationSubmission = {
  kind: LocationKind;
  name: string;
  description: string | null;
  address: string | null;
  lat: number;
  lng: number;
  categoryIds: string[];
  userId: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  hours?: OpeningHours | null;
  creatorVisible?: boolean;
  visibility?: LocationVisibility;
  expiresAt?: string | null;
};

export async function submitLocation(client: SupabaseClient, input: LocationSubmission): Promise<string> {
  const { data, error } = await client
    .from("locations")
    .insert({
      kind: input.kind,
      name: input.name,
      description: input.description,
      address: input.address,
      geom: `POINT(${input.lng} ${input.lat})`,
      created_by: input.userId,
      phone: input.phone ?? null,
      email: input.email ?? null,
      website: input.website ?? null,
      hours: input.hours ?? null,
      creator_visible: input.creatorVisible ?? true,
      visibility: input.visibility ?? "public",
      expires_at: input.expiresAt ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  const locationId = (data as { id: string }).id;

  if (input.categoryIds.length > 0) {
    const { error: categoryError } = await client
      .from("location_categories")
      .insert(input.categoryIds.map((categoryId) => ({ location_id: locationId, category_id: categoryId })));
    if (categoryError) throw categoryError;
  }

  return locationId;
}

export async function addLocationPhoto(
  client: SupabaseClient,
  locationId: string,
  userId: string,
  storagePath: string
): Promise<void> {
  const { error } = await client
    .from("location_photos")
    .insert({ location_id: locationId, user_id: userId, storage_path: storagePath });
  if (error) throw error;
}

export async function fetchLocationPhotos(client: SupabaseClient, locationId: string): Promise<string[]> {
  const { data, error } = await client
    .from("location_photos")
    .select("storage_path")
    .eq("location_id", locationId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as { storage_path: string }[]).map(
    (row) => client.storage.from("media").getPublicUrl(row.storage_path).data.publicUrl
  );
}

export type LocationReportInput = {
  locationId: string;
  reporterId: string;
  reason: string;
  details: string | null;
};

export async function reportLocation(client: SupabaseClient, input: LocationReportInput): Promise<void> {
  const { error } = await client.from("location_reports").insert({
    location_id: input.locationId,
    reporter_id: input.reporterId,
    reason: input.reason,
    details: input.details,
  });
  if (error) throw error;
}

export async function fetchLocationById(client: SupabaseClient, id: string): Promise<LocationDetail | null> {
  const { data, error } = await client
    .from("locations")
    .select(
      "id, kind, name, description, address, phone, email, website, hours, avg_rating, review_count, created_by, creator_visible, visibility, expires_at, is_boosted, is_verified, claimed_by, creator:profiles!locations_created_by_fkey(username), owner:profiles!locations_claimed_by_fkey(username), location_categories(categories(slug, name))"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as LocationDetailRow;
  const primaryCategory = row.location_categories?.[0]?.categories ?? null;
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    description: row.description,
    address: row.address,
    phone: row.phone,
    email: row.email,
    website: row.website,
    hours: row.hours,
    avg_rating: row.avg_rating,
    review_count: row.review_count,
    is_verified: row.is_verified,
    claimed_by: row.claimed_by,
    created_by: row.created_by,
    creator_username: row.creator_visible ? (row.creator?.username ?? null) : null,
    creator_visible: row.creator_visible,
    visibility: row.visibility,
    expires_at: row.expires_at,
    is_boosted: row.is_boosted,
    owner_username: row.is_verified ? (row.owner?.username ?? null) : null,
    category_slug: primaryCategory?.slug ?? null,
    category_label: primaryCategory?.name ?? null,
  };
}

export async function setLocationCreatorVisible(
  client: SupabaseClient,
  locationId: string,
  visible: boolean
): Promise<void> {
  const { error } = await client.from("locations").update({ creator_visible: visible }).eq("id", locationId);
  if (error) throw error;
}

export async function deleteLocation(client: SupabaseClient, locationId: string): Promise<void> {
  const { error } = await client.from("locations").delete().eq("id", locationId);
  if (error) throw error;
}

export type LocationUpdate = {
  name: string;
  description: string | null;
  address: string | null;
};

export async function updateLocation(
  client: SupabaseClient,
  locationId: string,
  input: LocationUpdate
): Promise<void> {
  const { error } = await client
    .from("locations")
    .update({ name: input.name, description: input.description, address: input.address })
    .eq("id", locationId);
  if (error) throw error;
}

export async function fetchLocationCategoryIds(client: SupabaseClient, locationId: string): Promise<string[]> {
  const { data, error } = await client
    .from("location_categories")
    .select("category_id")
    .eq("location_id", locationId);
  if (error) throw error;
  return (data ?? []).map((row) => row.category_id as string);
}

export async function setLocationCategories(
  client: SupabaseClient,
  locationId: string,
  categoryIds: string[]
): Promise<void> {
  const { error: deleteError } = await client
    .from("location_categories")
    .delete()
    .eq("location_id", locationId);
  if (deleteError) throw deleteError;

  if (categoryIds.length > 0) {
    const { error: insertError } = await client
      .from("location_categories")
      .insert(categoryIds.map((categoryId) => ({ location_id: locationId, category_id: categoryId })));
    if (insertError) throw insertError;
  }
}
