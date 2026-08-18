import type { SupabaseClient } from "@supabase/supabase-js";

export type ProfileStats = {
  favorites: number;
  bucketList: number;
  shared: number;
  reviews: number;
  added: number;
  lists: number;
  activities: number;
};

async function countRows(
  client: SupabaseClient,
  table: string,
  filters: Record<string, string>,
  nullColumns: string[] = []
): Promise<number> {
  let query = client.from(table).select("*", { count: "exact", head: true });
  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }
  // `.is(col, null)`, never `.eq(col, null)`: in SQL nothing equals null, so an
  // eq filter would silently match no rows and quietly report a count of zero.
  for (const column of nullColumns) {
    query = query.is(column, null);
  }
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function fetchProfileStats(
  client: SupabaseClient,
  userId: string
): Promise<ProfileStats> {
  const [favorites, bucketList, shared, reviews, added, lists, activities] = await Promise.all([
    countRows(client, "saves", { user_id: userId, kind: "favorite" }),
    countRows(client, "saves", { user_id: userId, kind: "bucket_list" }),
    countRows(client, "location_shares", { recipient_id: userId }),
    countRows(client, "reviews", { user_id: userId }),
    // import_batch is null keeps bulk-imported rows out of a person's own
    // numbers. Imports are created by a real account, so without this the
    // owner's "Added" tile reads five thousand and their three real
    // contributions are lost in it.
    countRows(client, "locations", { created_by: userId }, ["import_batch"]),
    countRows(client, "lists", { user_id: userId }),
    countRows(client, "locations", { created_by: userId, kind: "activity" }, ["import_batch"]),
  ]);

  return { favorites, bucketList, shared, reviews, added, lists, activities };
}

export type MyReview = {
  id: string;
  location_id: string;
  location_name: string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
};

type MyReviewRow = {
  id: string;
  location_id: string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  locations: { name: string } | null;
};

export async function fetchMyReviews(
  client: SupabaseClient,
  userId: string
): Promise<MyReview[]> {
  const { data, error } = await client
    .from("reviews")
    .select("id, location_id, rating, title, body, created_at, locations(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as MyReviewRow[])
    // An activity that has ended stops being relevant, and so does a review of
    // it — the same rule that retires the activity itself. A null embed is a
    // location this reader can no longer open, so the review goes with it.
    .filter((row) => row.locations !== null)
    .map((row) => ({
      id: row.id,
      location_id: row.location_id,
      location_name: row.locations!.name,
      rating: row.rating,
      title: row.title,
      body: row.body,
      created_at: row.created_at,
    }));
}

/**
 * Shown wherever a contribution outlived the account that made it.
 *
 * Since 0071 deleting an account anonymises reviews, photos and locations
 * rather than removing them, so a missing profile row means "this person left",
 * not "this person has no name". Distinct from "Anonymous", which is the
 * fallback for a profile that exists but has no handle set.
 */
export const DELETED_ACCOUNT_NAME = "Deleted account";

export type ThemePreference = "light" | "dark" | "system";

export type NotificationPreferences = {
  reviews: boolean;
  shares: boolean;
  marketing: boolean;
  /** "An activity you saved starts tomorrow." See migration 0093. */
  reminders: boolean;
};

/**
 * Marketing stays off unless it is actively opted into. Reminders are on,
 * because they are only ever sent about an activity the person deliberately
 * favourited or saved — that is delivering something they asked for, where
 * marketing would be deciding for them.
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  reviews: true,
  shares: true,
  marketing: false,
  reminders: true,
};

/**
 * "superuser" is the moderation tier (handles reports, can flag/hide/remove
 * content). "admin" is the company tier and keeps every superuser power plus
 * role management, hard deletes and claim decisions.
 */
export type UserRole = "user" | "superuser" | "admin";

/** Roles allowed to handle reports and moderate content. */
export function isModeratorRole(role: UserRole): boolean {
  return role === "superuser" || role === "admin";
}

export type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  theme_preference: ThemePreference;
  /**
   * Which language to write to this person from the server.
   *
   * Not what the app renders in — that is i18next, driven by the device and a
   * stored override. This exists for the things the app is not present for:
   * the activity reminders are built by a scheduled job, which has no way to
   * read AsyncStorage on somebody's phone.
   */
  locale: string | null;
  role: UserRole;
};

/**
 * The publicly readable half of a profile — this is what everyone sees on a
 * review, a location or a share sheet.
 *
 * `notification_preferences` is deliberately absent: the profiles SELECT policy
 * is `using (true)`, so any column named here is readable by anyone holding the
 * anon key. It is granted per-column to nobody and comes back through
 * `fetchMyPrivateProfile` instead. Adding it to this select would publish it to
 * the world — see migration 0066_profiles_hide_private_columns.sql.
 */
export async function fetchProfile(client: SupabaseClient, userId: string): Promise<Profile> {
  const { data, error } = await client
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, theme_preference, locale, role")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data as Profile;
}

export type PrivateProfile = {
  notification_preferences: NotificationPreferences;
};

/**
 * The signed-in user's own private settings, via a security-definer function
 * scoped to auth.uid(). It takes no user id on purpose — there is no parameter
 * to point at someone else's row.
 */
export async function fetchMyPrivateProfile(client: SupabaseClient): Promise<PrivateProfile> {
  const { data, error } = await client.rpc("my_private_profile");
  if (error) throw error;

  const row = (data ?? [])[0] as PrivateProfile | undefined;
  return {
    notification_preferences: row?.notification_preferences ?? DEFAULT_NOTIFICATION_PREFERENCES,
  };
}

export type ProfileUpdate = Partial<{
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  theme_preference: ThemePreference;
  locale: string;
  notification_preferences: NotificationPreferences;
}>;

export async function updateProfile(
  client: SupabaseClient,
  userId: string,
  updates: ProfileUpdate
): Promise<void> {
  const { error } = await client.from("profiles").update(updates).eq("id", userId);
  if (error) throw error;
}
