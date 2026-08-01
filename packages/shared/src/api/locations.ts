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
  city: string | null;
  country: string | null;
  distance_m: number;
  avg_rating: number;
  review_count: number;
  category_slug: string | null;
  category_label: string | null;
  starts_at: string | null;
  is_boosted: boolean;
  available_summer: boolean;
  available_winter: boolean;
  /** Storage path of the location's first photo, null if it has none. */
  cover_photo_path: string | null;
};

export type NearbyLocationsParams = {
  lat: number;
  lng: number;
  radiusM?: number;
  categorySlugs?: string[] | null;
  searchQuery?: string | null;
  sort?: "distance" | "rating";
  season?: "summer" | "winter" | null;
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
    season_filter: params.season ?? null,
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
  const rows = (data ?? []) as Category[];
  // Alphabetical, except "Others" always sorts last regardless of its name.
  return [...rows.filter((c) => c.slug !== "other"), ...rows.filter((c) => c.slug === "other")];
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
  hours_not_applicable: boolean;
  avg_rating: number;
  review_count: number;
  category_slug: string | null;
  category_label: string | null;
  created_by: string | null;
  creator_username: string | null;
  creator_visible: boolean;
  visibility: LocationVisibility;
  starts_at: string | null;
  publish_at: string;
  expires_at: string | null;
  is_boosted: boolean;
  is_verified: boolean;
  claimed_by: string | null;
  owner_username: string | null;
  available_summer: boolean;
  available_winter: boolean;
  other_category_detail: string | null;
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
  hours_not_applicable: boolean;
  avg_rating: number;
  review_count: number;
  created_by: string | null;
  creator: { username: string | null } | null;
  creator_visible: boolean;
  visibility: LocationVisibility;
  starts_at: string | null;
  publish_at: string;
  expires_at: string | null;
  is_boosted: boolean;
  is_verified: boolean;
  claimed_by: string | null;
  owner: { username: string | null } | null;
  location_categories: { categories: { slug: string; name: string } | null }[];
  available_summer: boolean;
  available_winter: boolean;
  other_category_detail: string | null;
};

export type LocationSubmission = {
  kind: LocationKind;
  name: string;
  description: string | null;
  address: string | null;
  city?: string | null;
  country?: string | null;
  lat: number;
  lng: number;
  categoryIds: string[];
  userId: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  hours?: OpeningHours | null;
  hoursNotApplicable?: boolean;
  creatorVisible?: boolean;
  visibility?: LocationVisibility;
  startsAt?: string | null;
  publishAt?: string | null;
  expiresAt?: string | null;
  otherCategoryDetail?: string | null;
  availableSummer?: boolean;
  availableWinter?: boolean;
};

export async function submitLocation(client: SupabaseClient, input: LocationSubmission): Promise<string> {
  const { data, error } = await client
    .from("locations")
    .insert({
      kind: input.kind,
      name: input.name,
      description: input.description,
      address: input.address,
      city: input.city ?? null,
      country: input.country ?? null,
      geom: `POINT(${input.lng} ${input.lat})`,
      created_by: input.userId,
      phone: input.phone ?? null,
      email: input.email ?? null,
      website: input.website ?? null,
      hours: input.hours ?? null,
      hours_not_applicable: input.hoursNotApplicable ?? false,
      creator_visible: input.creatorVisible ?? true,
      visibility: input.visibility ?? "public",
      starts_at: input.startsAt ?? null,
      publish_at: input.publishAt ?? new Date().toISOString(),
      expires_at: input.expiresAt ?? null,
      other_category_detail: input.otherCategoryDetail ?? null,
      available_summer: input.availableSummer ?? false,
      available_winter: input.availableWinter ?? false,
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

export type GalleryPhoto = {
  url: string;
  /**
   * The location_photos row id, or null for a photo that came from a review.
   *
   * Review photos belong to their review, not to the place, so they can't be
   * promoted to cover — the id is what the gallery uses to tell the two apart.
   */
  photoId: string | null;
};

/**
 * Every photo shown on a location: the location's own, then any from visible
 * reviews.
 *
 * Ordering deliberately matches the `cover` lateral in nearby_locations
 * (sort_order, then created_at ascending), so the picture on the card is the
 * same one that leads the gallery. These used to disagree — the card showed
 * the oldest photo while the gallery listed newest first, so the "hero shot"
 * on the card was the last one you reached by swiping.
 */
export async function fetchLocationPhotos(
  client: SupabaseClient,
  locationId: string
): Promise<GalleryPhoto[]> {
  const [locationPhotos, reviewPhotos] = await Promise.all([
    client
      .from("location_photos")
      .select("id, storage_path, sort_order")
      .eq("location_id", locationId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    client
      .from("reviews")
      .select("review_photos(storage_path)")
      .eq("location_id", locationId)
      .eq("status", "visible")
      .order("created_at", { ascending: false }),
  ]);
  if (locationPhotos.error) throw locationPhotos.error;
  if (reviewPhotos.error) throw reviewPhotos.error;

  const publicUrl = (storagePath: string) => client.storage.from("media").getPublicUrl(storagePath).data.publicUrl;

  const fromLocation = (locationPhotos.data as { id: string; storage_path: string }[]).map((row) => ({
    url: publicUrl(row.storage_path),
    photoId: row.id,
  }));
  const fromReviews = (reviewPhotos.data as { review_photos: { storage_path: string }[] }[]).flatMap((row) =>
    row.review_photos.map((photo) => ({ url: publicUrl(photo.storage_path), photoId: null }))
  );

  return [...fromLocation, ...fromReviews];
}

/**
 * Promotes a photo to the front of its location.
 *
 * Rather than renumbering every row, this drops the chosen photo one below the
 * current minimum. Everything starts at 0, so the first promotion lands at -1,
 * the next at -2, and existing order is otherwise undisturbed.
 *
 * Enforced by RLS to moderators and the verified owner (migration 0072) — this
 * will simply affect no rows for anyone else.
 */
export async function makeCoverPhoto(
  client: SupabaseClient,
  locationId: string,
  photoId: string
): Promise<void> {
  const { data, error } = await client
    .from("location_photos")
    .select("sort_order")
    .eq("location_id", locationId)
    .order("sort_order", { ascending: true })
    .limit(1);
  if (error) throw error;

  const lowest = (data as { sort_order: number }[])[0]?.sort_order ?? 0;

  const { error: updateError } = await client
    .from("location_photos")
    .update({ sort_order: lowest - 1 })
    .eq("id", photoId);
  if (updateError) throw updateError;
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
      "id, kind, name, description, address, phone, email, website, hours, hours_not_applicable, avg_rating, review_count, created_by, creator_visible, visibility, starts_at, publish_at, expires_at, is_boosted, is_verified, claimed_by, available_summer, available_winter, other_category_detail, creator:profiles!locations_created_by_fkey(username), owner:profiles!locations_claimed_by_fkey(username), location_categories(categories(slug, name))"
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
    hours_not_applicable: row.hours_not_applicable,
    avg_rating: row.avg_rating,
    review_count: row.review_count,
    is_verified: row.is_verified,
    claimed_by: row.claimed_by,
    created_by: row.created_by,
    creator_username: row.creator_visible ? (row.creator?.username ?? null) : null,
    creator_visible: row.creator_visible,
    visibility: row.visibility,
    starts_at: row.starts_at,
    publish_at: row.publish_at,
    expires_at: row.expires_at,
    is_boosted: row.is_boosted,
    owner_username: row.is_verified ? (row.owner?.username ?? null) : null,
    category_slug: primaryCategory?.slug ?? null,
    category_label: primaryCategory?.name ?? null,
    available_summer: row.available_summer,
    available_winter: row.available_winter,
    other_category_detail: row.other_category_detail,
  };
}

export type MyAddedLocation = {
  id: string;
  kind: LocationKind;
  name: string;
  category_label: string | null;
  avg_rating: number;
  review_count: number;
  is_verified: boolean;
  visibility: LocationVisibility;
  created_at: string;
};

type MyAddedLocationRow = {
  id: string;
  kind: LocationKind;
  name: string;
  avg_rating: number;
  review_count: number;
  is_verified: boolean;
  visibility: LocationVisibility;
  created_at: string;
  location_categories: { categories: { name: string } | null }[];
};

export async function fetchMyAddedLocations(client: SupabaseClient, userId: string): Promise<MyAddedLocation[]> {
  const { data, error } = await client
    .from("locations")
    .select(
      "id, kind, name, avg_rating, review_count, is_verified, visibility, created_at, location_categories(categories(name))"
    )
    .eq("created_by", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as MyAddedLocationRow[]).map((row) => ({
    id: row.id,
    kind: row.kind,
    name: row.name,
    category_label: row.location_categories?.[0]?.categories?.name ?? null,
    avg_rating: row.avg_rating,
    review_count: row.review_count,
    is_verified: row.is_verified,
    visibility: row.visibility,
    created_at: row.created_at,
  }));
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
  hours: OpeningHours | null;
  hoursNotApplicable: boolean;
  availableSummer: boolean;
  availableWinter: boolean;
};

export async function updateLocation(
  client: SupabaseClient,
  locationId: string,
  input: LocationUpdate
): Promise<void> {
  const { error } = await client
    .from("locations")
    .update({
      name: input.name,
      description: input.description,
      address: input.address,
      hours: input.hoursNotApplicable ? null : input.hours,
      hours_not_applicable: input.hoursNotApplicable,
      available_summer: input.availableSummer,
      available_winter: input.availableWinter,
    })
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
