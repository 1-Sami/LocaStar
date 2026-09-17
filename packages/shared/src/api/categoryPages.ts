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
/**
 * Places per page on a category listing.
 *
 * Exported because two places have to agree on it: the page that renders the
 * pager, and the sitemap that advertises those pages. If they ever drift, the
 * sitemap hands Google URLs the page answers with a 404.
 */
export const CATEGORY_PAGE_SIZE = 48;

/**
 * A category gets a page of its own in a town — /activity/basketball/huddinge
 * — only when the town has at least this many places in it.
 *
 * Below that the page would be one to four entries under a title that promises
 * a guide: thin to Google, and a letdown to anyone who arrived from a search.
 * Those towns stay reachable as the ?city= filter, which robots.txt keeps out
 * of search. Exported because the page and the sitemap have to agree on it, or
 * the sitemap advertises pages the page answers with a 404.
 */
export const CITY_PAGE_MIN_PLACES = 5;

/**
 * A town's name as it appears in a URL: "Göteborg" becomes "goteborg" and
 * "Upplands Väsby" becomes "upplands-vasby".
 *
 * Accents folded rather than kept: a Swedish reader types "goteborg" as often
 * as "göteborg", and a URL with ö in it reaches Google percent-encoded. The
 * page matches the slug back to a real town by running this same function over
 * the town list, so the two cannot disagree.
 */
export function citySlug(city: string): string {
  return city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function fetchCategoryPlaces(
  client: SupabaseClient,
  categoryId: string,
  options: { city?: string; limit?: number; offset?: number } = {}
): Promise<{ places: CategoryPlace[]; total: number }> {
  const { city, limit = CATEGORY_PAGE_SIZE, offset = 0 } = options;

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
/*
 * PostgREST caps every response at db-max-rows regardless of what .limit()
 * asks for, and says nothing about it — the reply just stops, with the real
 * total only in a Content-Range header nobody was reading. `.limit(10000)`
 * therefore returned 1,000 rows, so the sitemap advertised 1,000 of 6,857
 * places and 85% of the site was invisible to search. On a rebuild whose
 * entire purpose is search traffic, silently.
 *
 * Pages until a short page proves the end. PAGE deliberately matches the
 * server cap: asking for more just gets trimmed back to it.
 */
const PAGE = 1000;

async function fetchAllPages<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    const batch = data ?? [];
    all.push(...batch);
    if (batch.length < PAGE) return all;
  }
}

/* What the sitemap's locations query returns. The nested shape is PostgREST's:
   one row per category link, each wrapping the category it points at. */
type LocationSitemapRow = {
  id: string;
  created_at: string;
  city: string | null;
  location_categories: { categories: { slug: string } | null }[] | null;
};

export async function fetchSitemapEntries(
  client: SupabaseClient
): Promise<{ locations: SitemapEntry[]; lists: SitemapEntry[]; categories: SitemapEntry[] }> {
  const [locationRows, listRows, counts] = await Promise.all([
    fetchAllPages<LocationSitemapRow>((from, to) =>
      client
        .from("locations")
        // The category and town come along so the category and town pages can
        // carry a lastmod of their own: theirs is the newest place on them.
        .select("id, created_at, city, location_categories(categories(slug))")
        .order("created_at", { ascending: false })
        // Tiebreak on the primary key, or the paging is unsound: the import
        // wrote 6,857 rows across 97 timestamps, so hundreds share one value
        // and Postgres is free to order them differently per query. Rows then
        // repeat across page boundaries and others are skipped entirely — 290
        // duplicates and the same number missing, the first time this ran.
        .order("id", { ascending: true })
        // Cast at the boundary, the way the rest of this file does: with no
        // generated database types, the client types a to-one join as an
        // array, while PostgREST returns the single category it is.
        .range(from, to) as unknown as PromiseLike<{ data: LocationSitemapRow[] | null; error: unknown }>
    ),
    fetchAllPages<{ id: string; updated_at: string | null }>((from, to) =>
      client
        .from("lists")
        .select("id, updated_at")
        .eq("is_public", true)
        // Same reasoning, and worse without it: no ORDER BY at all means no
        // ordering guarantee whatsoever between the paged queries.
        .order("id", { ascending: true })
        .range(from, to)
    ),
    fetchCategoryCounts(client),
  ]);

  // Every category's towns, for the town pages. One call per category rather
  // than a new database function: the sitemap is built at most once an hour.
  const townsByCategory = await Promise.all(
    counts
      .filter((row) => row.count > 0)
      .map(async (row) => ({ slug: row.slug, towns: await fetchCategoryCityCounts(client, row.slug) }))
  );

  /*
   * The newest place on a page is that page's lastmod.
   *
   * Both were null before, which left 1,071 of the sitemap's URLs — every
   * category and town page, the substantial ones — with no date at all, while
   * the 16,584 thin place pages each had one. Rows arrive newest first, so the
   * first write per key is the newest.
   */
  const newestByCategory = new Map<string, string>();
  const newestByTown = new Map<string, string>();
  for (const row of locationRows) {
    for (const link of row.location_categories ?? []) {
      const slug = link.categories?.slug;
      if (!slug) continue;
      if (!newestByCategory.has(slug)) newestByCategory.set(slug, row.created_at);
      if (row.city) {
        const key = `${slug}|${row.city}`;
        if (!newestByTown.has(key)) newestByTown.set(key, row.created_at);
      }
    }
  }

  return {
    locations: locationRows.map((row) => ({
      path: `/location/${row.id}`,
      lastmod: row.created_at,
    })),
    lists: listRows.map((row) => ({
      path: `/lists/${row.id}`,
      lastmod: row.updated_at,
    })),
    // Empty categories are left out on purpose — a "0 places" page is thin, and
    // a sitemap full of them costs the crawl budget the good pages need.
    /*
     * Every page of every category, not just the first.
     *
     * The listing used to show 24 of a category's places with no way to reach
     * the rest, so 7,213 of 8,294 place pages had nothing linking to them and
     * sat in Search Console as "Discovered — currently not indexed". The pager
     * is what fixes that; listing its pages here is how Google finds the pager
     * without waiting to re-crawl page one first.
     */
    categories: [
      ...townPages(townsByCategory, newestByTown),
      ...counts
      .filter((row) => row.count > 0)
      .flatMap((row) => {
        const pages = Math.max(1, Math.ceil(row.count / CATEGORY_PAGE_SIZE));
        const lastmod = newestByCategory.get(row.slug) ?? null;
        return Array.from({ length: pages }, (_, i) => ({
          path: i === 0 ? `/activity/${row.slug}` : `/activity/${row.slug}?page=${i + 1}`,
          lastmod,
        }));
      }),
    ],
  };
}

/**
 * The town pages, and their own pages where a town has more than one page of
 * places — basketball in Stockholm has 105.
 */
function townPages(
  townsByCategory: { slug: string; towns: CategoryCityCount[] }[],
  newestByTown: Map<string, string>
): SitemapEntry[] {
  return townsByCategory.flatMap(({ slug, towns }) =>
    towns
      .filter((town) => town.count >= CITY_PAGE_MIN_PLACES)
      .flatMap((town) => {
        const base = `/activity/${slug}/${citySlug(town.city)}`;
        const pages = Math.max(1, Math.ceil(town.count / CATEGORY_PAGE_SIZE));
        // Keyed on the town as stored, not its slug: two towns can slug alike.
        const lastmod = newestByTown.get(`${slug}|${town.city}`) ?? null;
        return Array.from({ length: pages }, (_, i) => ({
          path: i === 0 ? base : `${base}?page=${i + 1}`,
          lastmod,
        }));
      })
  );
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
