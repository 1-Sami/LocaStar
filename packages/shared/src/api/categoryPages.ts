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
  categorySlug?: string | null;
  categoryName?: string | null;
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

export type CategoryCount = {
  slug: string;
  name: string;
  count: number;
};

/**
 * Every category with how many places it has.
 *
 * One round trip rather than 54. Used by the sitemap to skip empty categories,
 * and by the browse grid. RLS applies inside the function, so the numbers match
 * what a visitor can actually open.
 */
export async function fetchCategoryCounts(client: SupabaseClient): Promise<CategoryCount[]> {
  const { data, error } = await client.rpc("category_counts");
  if (error) throw error;
  return ((data ?? []) as { slug: string; name: string; n: number }[]).map((row) => ({
    slug: row.slug,
    name: row.name,
    count: Number(row.n),
  }));
}

export type SitemapEntry = {
  path: string;
  lastmod: string | null;
};

/**
 * Everything the sitemap should list.
 *
 * Locations come back filtered by RLS, so a retired activity or a removed place
 * drops out on its own — which is the requirement, and the reason this is
 * generated per request rather than baked at build time.
 *
 * `locations` has no updated_at, so created_at is the best lastmod available.
 * It understates freshness when a review is added later; lastmod is a hint to
 * crawlers rather than a promise, so that is acceptable.
 */
export async function fetchSitemapEntries(
  client: SupabaseClient
): Promise<{ locations: SitemapEntry[]; lists: SitemapEntry[]; categories: SitemapEntry[] }> {
  const [locationsResult, listsResult, counts] = await Promise.all([
    client.from("locations").select("id, created_at").order("created_at", { ascending: false }).limit(10000),
    client.from("lists").select("id, updated_at").eq("is_public", true).limit(10000),
    fetchCategoryCounts(client),
  ]);

  if (locationsResult.error) throw locationsResult.error;
  if (listsResult.error) throw listsResult.error;

  return {
    locations: ((locationsResult.data ?? []) as { id: string; created_at: string }[]).map((row) => ({
      path: `/location/${row.id}`,
      lastmod: row.created_at,
    })),
    lists: ((listsResult.data ?? []) as { id: string; updated_at: string | null }[]).map((row) => ({
      path: `/lists/${row.id}`,
      lastmod: row.updated_at,
    })),
    // Empty categories are left out on purpose — a "0 places" page is thin, and
    // a sitemap full of them costs the crawl budget the good pages need.
    categories: counts
      .filter((row) => row.count > 0)
      .map((row) => ({ path: `/activity/${row.slug}`, lastmod: null })),
  };
}

/**
 * How many places exist, counted once each.
 *
 * Not the sum of the category counts: a location can sit in more than one
 * category, so adding those up overstates the total — it read 1002 against 998
 * real places the first time the home page tried it. RLS applies, so this is
 * the number a visitor could actually reach.
 */
export async function fetchLocationTotal(client: SupabaseClient): Promise<number> {
  const { count, error } = await client.from("locations").select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

/**
 * The best-reviewed places, for the website's home strip.
 *
 * Only places somebody has actually reviewed. The app's Most Liked carousel
 * follows the same rule — showing unrated places under "most liked" is
 * meaningless when 989 of 998 sit at 0.0, and it was changed there for exactly
 * that reason.
 *
 * This is what the server renders and what a crawler indexes. If a visitor
 * grants location the strip can be re-sorted by distance in the browser; until
 * then "nearest" is not something the server can honestly claim.
 */
export async function fetchMostLikedPlaces(
  client: SupabaseClient,
  limit = 4
): Promise<CategoryPlace[]> {
  const { data, error } = await client
    .from("locations")
    .select(
      "id, name, address, city, avg_rating, review_count, location_photos(storage_path), location_categories(categories(slug, name))"
    )
    .gt("review_count", 0)
    .order("avg_rating", { ascending: false })
    .order("review_count", { ascending: false })
    .limit(limit);
  if (error) throw error;

  type Row = {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    avg_rating: number;
    review_count: number;
    location_photos: { storage_path: string }[] | null;
    location_categories: { categories: { slug: string; name: string } | null }[] | null;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city,
    avgRating: row.avg_rating,
    reviewCount: row.review_count,
    coverPhotoPath: row.location_photos?.[0]?.storage_path ?? null,
    categorySlug: row.location_categories?.[0]?.categories?.slug ?? null,
    categoryName: row.location_categories?.[0]?.categories?.name ?? null,
  }));
}
