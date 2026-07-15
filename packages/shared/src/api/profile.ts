import type { SupabaseClient } from "@supabase/supabase-js";

export type ProfileStats = {
  favorites: number;
  bucketList: number;
  shared: number;
  reviews: number;
  added: number;
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
  const [favorites, bucketList, shared, reviews, added] = await Promise.all([
    countRows(client, "saves", { user_id: userId, kind: "favorite" }),
    countRows(client, "saves", { user_id: userId, kind: "bucket_list" }),
    countRows(client, "location_shares", { recipient_id: userId }),
    countRows(client, "reviews", { user_id: userId }),
    countRows(client, "locations", { created_by: userId }),
  ]);

  return { favorites, bucketList, shared, reviews, added };
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

export type UserRole = "user" | "admin";

export type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  home_address: string | null;
  theme_preference: ThemePreference;
  notification_preferences: NotificationPreferences;
  role: UserRole;
};

export async function fetchProfile(client: SupabaseClient, userId: string): Promise<Profile> {
  const { data, error } = await client
    .from("profiles")
    .select(
      "id, username, display_name, bio, avatar_url, home_address, theme_preference, notification_preferences, role"
    )
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data as Profile;
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
