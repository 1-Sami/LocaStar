import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * Queries behind /activity/<slug>, the website's category landing pages.
 *
 * Kept here with everything else that talks to Supabase rather than in the web
 * app, for the same reason as the rest: one place that knows the shapes.
 */

export type CategoryCityCount = {
  city: string;
  count: number;
};

export type CategoryPlace = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  avgRating: number;
  reviewCount: number;
  coverPhotoPath: string | null;
};

export type CategorySummary = {
  id: string;
  slug: string;
  name: string;
};

/** The category itself, or null when the slug is not one we have. */
export async function fetchCategoryBySlug(
  client: SupabaseClient,
  slug: string
): Promise<CategorySummary | null> {
  const { data, error } = await client
    .from("categories")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as CategorySummary | null) ?? null;
}

/** Every category, for generating the pages and for the related-activity chips. */
export async function fetchAllCategories(client: SupabaseClient): Promise<CategorySummary[]> {
  const { data, error } = await client.from("categories").select("id, slug, name").order("name");
  if (error) throw error;
  return (data ?? []) as CategorySummary[];
}

/**
 * Which cities have places in this category, and how many.
 *
 * A GROUP BY, so it goes through a function rather than PostgREST — see
 * migration 0116. SECURITY INVOKER there means RLS still applies, so a place a
 * moderator removed is not counted into a public total.
 */
export async function fetchCategoryCityCounts(
  client: SupabaseClient,
  slug: string
): Promise<CategoryCityCount[]> {
  const { data, error } = await client.rpc("category_city_counts", { p_slug: slug });
  if (error) throw error;
  return ((data ?? []) as { city: string; n: number }[]).map((row) => ({
    city: row.city,
    count: Number(row.n),
  }));
}

/**
 * Places in a category, optionally narrowed to one city.
 *
 * Two steps rather than one: PostgREST cannot filter the outer table by a
 * value on a nested embed, so the category's id is looked up first and the
 * join table filtered on that.
 *
 * Ordered by review count then name, deliberately — not by distance. The
 * server has no idea where the visitor is, and 989 of 996 places have no
 * reviews, so "the ones somebody has actually written about" is both the most
 * useful first impression and the only ordering that means anything to a
 * crawler.
 */
export async function fetchCategoryPlaces(
  client: SupabaseClient,
  categoryId: string,
  options: { city?: string; limit?: number; offset?: number } = {}
): Promise<{ places: CategoryPlace[]; total: number }> {
  const { city, limit = 24, offset = 0 } = options;

  let query = client
    .from("locations")
    .select(
      "id, name, address, city, avg_rating, review_count, location_categories!inner(category_id), location_photos(storage_path)",
      { count: "exact" }
    )
    .eq("location_categories.category_id", categoryId)
    .order("review_count", { ascending: false })
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);

  if (city) query = query.eq("city", city);

  const { data, error, count } = await query;
  if (error) throw error;

  type Row = {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    avg_rating: number;
    review_count: number;
    location_photos: { storage_path: string }[] | null;
  };

  const places = ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city,
    avgRating: row.avg_rating,
    reviewCount: row.review_count,
    coverPhotoPath: row.location_photos?.[0]?.storage_path ?? null,
  }));

  return { places, total: count ?? places.length };
}
