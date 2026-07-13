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
