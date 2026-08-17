import type { SupabaseClient } from "@supabase/supabase-js";

export type LocationKind = "place" | "activity";
export type LocationVisibility = "public" | "private";

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type OpeningHours = Partial<Record<DayKey, { open: string; close: string }>>;

export const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/**
 * Always open, expressed in the shape the column already has: every day from
 * midnight to midnight.
 *
 * Deliberately not a new `open_24_7` column. A boolean beside `hours` invites
 * the two disagreeing — a place flagged always-open while also carrying
 * Tuesday 09:00-17:00 — and every reader would then have to know which wins.
 * As seven full days it is simply true, and the existing open/closed logic
 * needs no special case: 00:00 to 24:00 always contains now.
 */
export const ALWAYS_OPEN: OpeningHours = DAY_KEYS.reduce<OpeningHours>((acc, day) => {
  acc[day] = { open: "00:00", close: "24:00" };
  return acc;
}, {});

/** True when hours cover every day in full — what the UI shows as "Open 24 hours". */
export function isAlwaysOpen(hours: OpeningHours | null | undefined): boolean {
  if (!hours) return false;
  return DAY_KEYS.every((day) => hours[day]?.open === "00:00" && hours[day]?.close === "24:00");
}

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
  /**
   * The location's own coordinates, for routing.
   *
   * Named result_* rather than lat/lng because those are the RPC's parameter
   * names, and a returned column sharing a parameter name is the ambiguity that
   * broke every distance in migration 0077.
   */
  result_lat: number;
  result_lng: number;
  /**
   * How many rows matched in total, before max_results was applied. Repeated on
   * every row — it is a window function, not a separate query.
   *
   * Search used to count the rows it had been handed and call that the result
   * count, which meant it printed the cap: "100 RESULTS" whether there were a
   * hundred or eight hundred.
   */
  total_count: number;
};

export type NearbyLocationsParams = {
  lat: number;
  lng: number;
  radiusM?: number;
  categorySlugs?: string[] | null;
  searchQuery?: string | null;
  sort?: "distance" | "rating";
  season?: "summer" | "winter" | null;
  /**
   * Most rows to return. The RPC defaults to 100; before migration 0083 there
   * was no cap at all, so every search returned the entire table.
   */
  maxResults?: number;
  /**
   * Restrict to places or to activities. Null means both, which is what every
   * caller but Home's activities row wants.
   *
   * It exists because distance is the wrong axis for an activity: people drive
   * an hour and a half to a festival and not five minutes to a boule court, so
   * activities cannot be left to compete with courts for slots in a capped
   * proximity query. See migration 0086.
   */
  kind?: "place" | "activity" | null;
  /**
   * Rows to skip, for paging. Safe to page with because migration 0088 gave
   * the RPC a total order — before it, the rating sort left every unrated row
   * tied and consecutive pages both repeated and lost rows.
   */
  offset?: number;
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
    max_results: params.maxResults ?? 100,
    kind_filter: params.kind ?? null,
    result_offset: params.offset ?? 0,
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
  /** 'past' once an activity has ended: still its creator's, gone for everyone else. */
  status: string;
  starts_at: string | null;
  publish_at: string;
  /** Drives the creator's 24-hour edit window (migration 0079). */
  created_at: string;
  expires_at: string | null;
  is_boosted: boolean;
  is_verified: boolean;
  claimed_by: string | null;
  owner_username: string | null;
  available_summer: boolean;
  available_winter: boolean;
  other_category_detail: string | null;
  /** From generated columns on locations, so the screen can show how far away it is. */
  lat: number;
  lng: number;
};

type LocationDetailRow = {
  lat: number;
  lng: number;
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
  /** 'past' once an activity has ended: still its creator's, gone for everyone else. */
  status: string;
  starts_at: string | null;
  publish_at: string;
  /** Drives the creator's 24-hour edit window (migration 0079). */
  created_at: string;
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
  /** Needed to remove the stored file, not just the row, when a photo is deleted. */
  storagePath: string;
  /**
   * The review this came from, and the review_photos row within it. Both null
   * for a photo belonging to the place itself.
   *
   * Carried so the viewer can report one photo: a report has to name the thing
   * complained about, and for a review photo that means the review it hangs off
   * as well as the photo row.
   */
  reviewId: string | null;
  reviewPhotoId: string | null;
  /**
   * Who to credit, or null to credit nobody.
   *
   * Null covers two different situations that look the same to the viewer: the
   * uploader has no username, or they added the place without wanting to be
   * named on it. Deliberately resolved here rather than in the screen — the
   * screen should not have to know the rule to avoid breaking it.
   *
   * Not a privacy control. created_by and user_id are stored either way, and
   * the moderation queue reads them directly, so a reported photo can always be
   * traced to the person who put it there.
   */
  uploaderName: string | null;
  /**
   * Who uploaded it, always — unlike uploaderName, which respects the
   * do-not-credit setting. Used to keep somebody from reporting their own
   * photo, and never displayed.
   */
  uploaderId: string | null;
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
      .select("id, storage_path, sort_order, user_id, profiles(username), locations!inner(creator_visible, created_by)")
      .eq("location_id", locationId)
      // Reported photos are held out of sight until a moderator rules on them;
      // removed ones are in the trash awaiting the purge.
      .is("hidden_at", null)
      .is("removed_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    client
      .from("reviews")
      .select("id, user_id, profiles(username), review_photos(id, storage_path, hidden_at, removed_at)")
      .eq("location_id", locationId)
      .eq("status", "visible")
      .order("created_at", { ascending: false }),
  ]);
  if (locationPhotos.error) throw locationPhotos.error;
  if (reviewPhotos.error) throw reviewPhotos.error;

  const publicUrl = (storagePath: string) => client.storage.from("media").getPublicUrl(storagePath).data.publicUrl;

  type LocationPhotoRow = {
    id: string;
    storage_path: string;
    user_id: string | null;
    profiles: { username: string | null } | null;
    locations: { creator_visible: boolean; created_by: string | null } | null;
  };
  const fromLocation = (locationPhotos.data as unknown as LocationPhotoRow[]).map((row) => {
    /*
     * The opt-out belongs to the person who added the place, so it only
     * suppresses their own name.
     *
     * creator_visible lives on the location, not on the photo. Reading it as
     * "credit nobody here" would be right today — every photo so far was
     * uploaded by the place's own creator — and wrong the first time somebody
     * adds a photo to a place they did not create, in either direction: their
     * name hidden because a stranger opted out, or shown because a stranger
     * did not.
     */
    const uploaderIsCreator = row.user_id !== null && row.user_id === row.locations?.created_by;
    const optedOut = uploaderIsCreator && row.locations?.creator_visible === false;
    return {
      url: publicUrl(row.storage_path),
      photoId: row.id,
      storagePath: row.storage_path,
      reviewId: null,
      reviewPhotoId: null,
      uploaderName: optedOut ? null : (row.profiles?.username ?? null),
      uploaderId: row.user_id,
    };
  });

  type ReviewRow = {
    id: string;
    user_id: string | null;
    profiles: { username: string | null } | null;
    review_photos: { id: string; storage_path: string; hidden_at: string | null; removed_at: string | null }[];
  };
  const fromReviews = (reviewPhotos.data as unknown as ReviewRow[]).flatMap((row) =>
    row.review_photos
      // A nested embed cannot be filtered by the outer query, so the hold
      // is applied here instead.
      .filter((photo) => photo.hidden_at === null && photo.removed_at === null)
      .map((photo) => ({
      url: publicUrl(photo.storage_path),
      photoId: null,
      storagePath: photo.storage_path,
      reviewId: row.id,
      reviewPhotoId: photo.id,
      // A review already shows its author on the same screen, so there is
      // nothing here to keep back.
      uploaderName: row.profiles?.username ?? null,
      uploaderId: row.user_id,
    }))
  );

  return [...fromLocation, ...fromReviews];
}

/**
 * Removes a location photo, for its uploader or a moderator.
 *
 * The row is what the gallery reads, so it goes first; the stored object is
 * tidied afterwards and never allowed to fail the removal. A moderator taking
 * down something harmful must not be left looking at it because the storage
 * call timed out.
 */
export async function deleteLocationPhoto(
  client: SupabaseClient,
  photoId: string,
  storagePath: string | null
): Promise<void> {
  const { error } = await client.from("location_photos").delete().eq("id", photoId);
  if (error) throw error;
  // Best effort, and deliberately unchecked: the row is what the gallery reads,
  // so the photo is already gone from view. An orphaned object is worth less
  // than leaving a moderator staring at an image they just took down.
  if (storagePath) await client.storage.from("media").remove([storagePath]);
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
  /** Set to report one photo rather than the listing as a whole. */
  locationPhotoId?: string | null;
};

export async function reportLocation(client: SupabaseClient, input: LocationReportInput): Promise<void> {
  const { error } = await client.from("location_reports").insert({
    location_id: input.locationId,
    reporter_id: input.reporterId,
    reason: input.reason,
    details: input.details,
    location_photo_id: input.locationPhotoId ?? null,
  });
  if (error) throw error;
}

export async function fetchLocationById(client: SupabaseClient, id: string): Promise<LocationDetail | null> {
  const { data, error } = await client
    .from("locations")
    .select(
      "id, kind, name, description, address, phone, email, website, hours, hours_not_applicable, avg_rating, review_count, created_by, creator_visible, visibility, status, starts_at, publish_at, created_at, expires_at, is_boosted, is_verified, claimed_by, available_summer, available_winter, other_category_detail, lat, lng, creator:profiles!locations_created_by_fkey(username), owner:profiles!locations_claimed_by_fkey(username), location_categories(categories(slug, name))"
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
    status: row.status,
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
    created_at: row.created_at,
    expires_at: row.expires_at,
    is_boosted: row.is_boosted,
    owner_username: row.is_verified ? (row.owner?.username ?? null) : null,
    category_slug: primaryCategory?.slug ?? null,
    category_label: primaryCategory?.name ?? null,
    available_summer: row.available_summer,
    available_winter: row.available_winter,
    other_category_detail: row.other_category_detail,
    lat: row.lat,
    lng: row.lng,
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
  /** Both null for a place. On an activity, what it runs between. */
  starts_at: string | null;
  expires_at: string | null;
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
  starts_at: string | null;
  expires_at: string | null;
  location_categories: { categories: { name: string } | null }[];
};

export async function fetchMyAddedLocations(client: SupabaseClient, userId: string): Promise<MyAddedLocation[]> {
  const { data, error } = await client
    .from("locations")
    .select(
      "id, kind, name, avg_rating, review_count, is_verified, visibility, created_at, starts_at, expires_at, location_categories(categories(name))"
    )
    .eq("created_by", userId)
    // "My contributions" means what this person added, not what a bulk import
    // filed under their account. `.is`, not `.eq` — nothing equals null.
    .is("import_batch", null)
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
    starts_at: row.starts_at,
    expires_at: row.expires_at,
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

/**
 * Removes a location and everything hanging off it.
 *
 * Every foreign key into locations is ON DELETE CASCADE, so the row takes its
 * reviews, photos, saves, shares, list items, reports and claims with it. What
 * cascade cannot reach is the storage bucket: the location_photos and
 * review_photos rows disappear along with the only record of where their files
 * live, so the objects are stranded with nothing pointing at them. Collect the
 * paths *before* deleting, then tidy up after.
 *
 * Permitted to admins, and to the creator of a private activity (0081).
 */
export async function deleteLocation(client: SupabaseClient, locationId: string): Promise<void> {
  const [locationPhotos, reviewPhotos] = await Promise.all([
    client.from("location_photos").select("storage_path").eq("location_id", locationId),
    client.from("reviews").select("review_photos(storage_path)").eq("location_id", locationId),
  ]);

  const paths = [
    ...((locationPhotos.data ?? []) as { storage_path: string }[]).map((row) => row.storage_path),
    ...((reviewPhotos.data ?? []) as { review_photos: { storage_path: string }[] }[]).flatMap((row) =>
      row.review_photos.map((photo) => photo.storage_path)
    ),
  ].filter(Boolean);

  const { error } = await client.from("locations").delete().eq("id", locationId);
  if (error) throw error;

  // Best effort, and deliberately unchecked: the rows are gone, so the place is
  // already out of the app. An orphaned file is worth less than an error thrown
  // at someone whose delete actually succeeded.
  if (paths.length > 0) await client.storage.from("media").remove(paths);
}

export type LocationUpdate = {
  name: string;
  description: string | null;
  address: string | null;
  /**
   * New coordinates, or undefined to leave the pin where it is.
   *
   * Only moderators and verified owners can actually move it -- the creator
   * guard trigger pins geom for everyone else and silently reverts the change.
   */
  lat?: number;
  lng?: number;
  /**
   * Where the new pin landed, or undefined to leave what is stored.
   *
   * Neither is ever typed -- both come from the geocoder -- so nothing else
   * can keep them true when a place moves. Editing had no way to write them at
   * all, which meant dragging a pin to another town left the old city on the
   * row, and city is what the planned per-city pages will be built from.
   *
   * Undefined rather than null on an ordinary save: sending null would blank a
   * city that was already correct.
   */
  city?: string | null;
  country?: string | null;
  /**
   * Contact details, or undefined to leave them as they are.
   *
   * Both were writable at creation and readable by fetchLocationById, but no
   * screen offered a way to change them, so a typo in a website was permanent.
   * Same creator-guard caveat as the pin: the trigger pins phone, email and
   * website for anyone who is not a moderator or the verified owner.
   */
  website?: string | null;
  phone?: string | null;
  email?: string | null;
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
      ...(input.lat !== undefined && input.lng !== undefined
        ? { geom: `POINT(${input.lng} ${input.lat})` }
        : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.country !== undefined ? { country: input.country } : {}),
      ...(input.website !== undefined ? { website: input.website } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
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
