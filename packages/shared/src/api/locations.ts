import type { SupabaseClient } from "@supabase/supabase-js";

export type LocationKind = "place" | "activity";

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
  avg_rating: number;
  review_count: number;
  category_slug: string | null;
  category_label: string | null;
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
  avg_rating: number;
  review_count: number;
  location_categories: { categories: { slug: string; name: string } | null }[];
};

export async function fetchLocationById(client: SupabaseClient, id: string): Promise<LocationDetail | null> {
  const { data, error } = await client
    .from("locations")
    .select(
      "id, kind, name, description, address, phone, email, website, avg_rating, review_count, location_categories(categories(slug, name))"
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
    avg_rating: row.avg_rating,
    review_count: row.review_count,
    category_slug: primaryCategory?.slug ?? null,
    category_label: primaryCategory?.name ?? null,
  };
}
