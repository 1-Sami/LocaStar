import type { SupabaseClient } from "@supabase/supabase-js";

export type Review = {
  id: string;
  user_id: string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  author_name: string;
  author_avatar_url: string | null;
};

type ReviewRow = {
  id: string;
  user_id: string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
};

export async function fetchReviews(client: SupabaseClient, locationId: string): Promise<Review[]> {
  const { data, error } = await client
    .from("reviews")
    .select("id, user_id, rating, title, body, created_at, profiles(display_name, avatar_url)")
    .eq("location_id", locationId)
    .eq("status", "visible")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as ReviewRow[]).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    rating: row.rating,
    title: row.title,
    body: row.body,
    created_at: row.created_at,
    author_name: row.profiles?.display_name ?? "Anonymous",
    author_avatar_url: row.profiles?.avatar_url ?? null,
  }));
}

export type ReviewInput = {
  locationId: string;
  userId: string;
  rating: number;
  title: string | null;
  body: string | null;
};

export async function submitReview(client: SupabaseClient, input: ReviewInput): Promise<void> {
  const { error } = await client.from("reviews").upsert(
    {
      location_id: input.locationId,
      user_id: input.userId,
      rating: input.rating,
      title: input.title,
      body: input.body,
    },
    { onConflict: "location_id,user_id" }
  );
  if (error) throw error;
}
