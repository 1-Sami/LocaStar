import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * Search for the website.
 *
 * Deliberately not `nearby_locations`: that RPC needs a latitude and longitude,
 * and the server rendering these pages has neither — nor does a crawler. It
 * also has no offset, and the whole point of the web search page is that
 * `/search?activity=basketball&page=3` is a real, linkable, indexable URL.
 */

export type SearchParams = {
  query?: string | null;
  categorySlugs?: string[];
  kind?: "place" | "activity" | null;
  season?: "summer" | "winter" | null;
  sort?: "rating" | "reviews" | "name";
  /** Which end of the chosen sort comes first. */
  direction?: "desc" | "asc";
  page?: number;
  perPage?: number;
};

export type SearchResult = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  avgRating: number;
  reviewCount: number;
  kind: "place" | "activity";
  categorySlug: string | null;
  categoryName: string | null;
  coverPhotoPath: string | null;
  lat: number;
  lng: number;
};

export type SearchResponse = {
  results: SearchResult[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
};

type SearchRow = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  avg_rating: number;
  review_count: number;
  kind: "place" | "activity";
  lat: number;
  lng: number;
  location_photos: { storage_path: string }[] | null;
  location_categories: { categories: { slug: string; name: string } | null }[] | null;
};

export async function fetchSearchResults(
  client: SupabaseClient,
  params: SearchParams = {}
): Promise<SearchResponse> {
  const {
    query,
    categorySlugs = [],
    kind,
    season,
    sort = "rating",
    direction = "desc",
    page = 1,
    perPage = 20,
  } = params;

  const safePage = Math.max(1, Math.floor(page));
  const from = (safePage - 1) * perPage;

  let request = client
    .from("locations")
    .select(
      "id, name, address, city, avg_rating, review_count, kind, lat, lng, location_photos(storage_path), location_categories!inner(categories!inner(slug, name))",
      { count: "exact" }
    );

  /*
   * Substring match on name and address rather than the `search_text` tsvector.
   *
   * That column is generated with the `simple` config, which does no stemming,
   * so "padel" never matches "padelbana" — the exact thing somebody types.
   * ilike does, and `locations_name_trgm_idx` is a trigram index that makes it
   * cheap. The cost is that the description is not searched; worth it, because
   * a search that misses the obvious word looks broken.
   */
  const trimmed = query?.trim();
  if (trimmed) {
    const escaped = trimmed.replace(/[%_,()]/g, " ").trim();
    if (escaped) {
      request = request.or(`name.ilike.%${escaped}%,address.ilike.%${escaped}%,city.ilike.%${escaped}%`);
    }
  }

  if (categorySlugs.length > 0) {
    request = request.in("location_categories.categories.slug", categorySlugs);
  }
  if (kind) request = request.eq("kind", kind);
  if (season === "summer") request = request.eq("available_summer", true);
  if (season === "winter") request = request.eq("available_winter", true);

  /*
   * Rating first, then review count as the tiebreaker: every unreviewed place
   * sits at 0.0, so without it the order is arbitrary and changes between
   * requests, which makes pagination skip and repeat rows.
   *
   * The direction reverses the column being sorted on, not the tiebreakers —
   * "worst rated" still wants the most-reviewed of the bad ones first, because
   * one grumpy review is not evidence of anything.
   */
  const ascending = direction === "asc";
  if (sort === "rating") {
    request = request.order("avg_rating", { ascending }).order("review_count", { ascending: false });
  } else if (sort === "reviews") {
    request = request.order("review_count", { ascending }).order("avg_rating", { ascending: false });
  }
  request = request.order("name", { ascending: sort === "name" ? !ascending : true }).range(from, from + perPage - 1);

  const { data, error, count } = await request;
  if (error) throw error;

  const total = count ?? 0;
  return {
    results: ((data ?? []) as unknown as SearchRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      city: row.city,
      avgRating: row.avg_rating,
      reviewCount: row.review_count,
      kind: row.kind,
      categorySlug: row.location_categories?.[0]?.categories?.slug ?? null,
      categoryName: row.location_categories?.[0]?.categories?.name ?? null,
      coverPhotoPath: row.location_photos?.[0]?.storage_path ?? null,
      lat: row.lat,
      lng: row.lng,
    })),
    total,
    page: safePage,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}
