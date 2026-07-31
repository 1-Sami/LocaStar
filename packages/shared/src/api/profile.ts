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
  filters: Record<string, string>
): Promise<number> {
  let query = client.from(table).select("*", { count: "exact", head: true });
  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
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
    countRows(client, "locations", { created_by: userId }),
    countRows(client, "lists", { user_id: userId }),
    countRows(client, "locations", { created_by: userId, kind: "activity" }),
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

export type ThemePreference = "light" | "dark" | "system";

export type NotificationPreferences = {
  reviews: boolean;
  shares: boolean;
  marketing: boolean;
};

/** Marketing stays off unless it is actively opted into. */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  reviews: true,
  shares: true,
  marketing: false,
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
  role: UserRole;
};

/**
 * The publicly readable half of a profile — this is what everyone sees on a
 * review, a location or a share sheet.
 *
 * `home_address` and `notification_preferences` are deliberately absent: the
 * profiles SELECT policy is `using (true)`, so any column named here is
 * readable by anyone holding the anon key. Those two are granted per-column to
 * nobody and come back through `fetchMyPrivateProfile` instead. Adding either
 * one to this select would publish it to the world — see migration
 * 0066_profiles_hide_private_columns.sql.
 */
export async function fetchProfile(client: SupabaseClient, userId: string): Promise<Profile> {
  const { data, error } = await client
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, theme_preference, role")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data as Profile;
}

export type PrivateProfile = {
  home_address: string | null;
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
    home_address: row?.home_address ?? null,
    notification_preferences: row?.notification_preferences ?? DEFAULT_NOTIFICATION_PREFERENCES,
  };
}

export type ProfileUpdate = Partial<{
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  home_address: string | null;
  theme_preference: ThemePreference;
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
