import type { SupabaseClient } from "@supabase/supabase-js";

import { DELETED_ACCOUNT_NAME } from "./profile";

export type Review = {
  id: string;
  /** Null once the author deleted their account; the review is kept. */
  user_id: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  author_name: string;
  author_avatar_url: string | null;
  likeCount: number;
  likedByMe: boolean;
  photos: string[];
};

type ReviewRow = {
  id: string;
  user_id: string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  profiles: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
  review_likes: { count: number }[];
  review_photos: { storage_path: string }[];
};

export async function fetchReviews(
  client: SupabaseClient,
  locationId: string,
  currentUserId?: string
): Promise<Review[]> {
  const { data, error } = await client
    .from("reviews")
    .select(
      "id, user_id, rating, title, body, created_at, profiles(username, display_name, avatar_url), review_likes(count), review_photos(storage_path)"
    )
    .eq("location_id", locationId)
    .eq("status", "visible")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as ReviewRow[];

  let likedReviewIds = new Set<string>();
  if (currentUserId && rows.length > 0) {
    const { data: likedRows, error: likedError } = await client
      .from("review_likes")
      .select("review_id")
      .eq("user_id", currentUserId)
      .in(
        "review_id",
        rows.map((row) => row.id)
      );
    if (likedError) throw likedError;
    likedReviewIds = new Set((likedRows ?? []).map((row) => row.review_id as string));
  }

  return rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    rating: row.rating,
    title: row.title,
    body: row.body,
    created_at: row.created_at,
    // Username first, matching how the DB triggers name people. Accounts made
    // with just an email have no display_name, so preferring it showed
    // "Anonymous" for everyone who never set one in settings.
    //
    // No profile row at all is a different case: since 0071 the author deleted
    // their account and the review was kept, unattributed. Testing the row
    // rather than the names keeps those two apart.
    author_name: row.profiles
      ? (row.profiles.username ?? row.profiles.display_name ?? "Anonymous")
      : DELETED_ACCOUNT_NAME,
    author_avatar_url: row.profiles?.avatar_url ?? null,
    likeCount: row.review_likes?.[0]?.count ?? 0,
    likedByMe: likedReviewIds.has(row.id),
    photos: (row.review_photos ?? []).map(
      (photo) => client.storage.from("media").getPublicUrl(photo.storage_path).data.publicUrl
    ),
  }));
}

export async function setReviewLiked(
  client: SupabaseClient,
  reviewId: string,
  userId: string,
  liked: boolean
): Promise<void> {
  if (liked) {
    const { error } = await client.from("review_likes").insert({ review_id: reviewId, user_id: userId });
    if (error) throw error;
  } else {
    const { error } = await client
      .from("review_likes")
      .delete()
      .match({ review_id: reviewId, user_id: userId });
    if (error) throw error;
  }
}

export type ReviewInput = {
  locationId: string;
  userId: string;
  rating: number;
  title: string | null;
  body: string | null;
};

export async function submitReview(client: SupabaseClient, input: ReviewInput): Promise<string> {
  const { data, error } = await client
    .from("reviews")
    .upsert(
      {
        location_id: input.locationId,
        user_id: input.userId,
        rating: input.rating,
        title: input.title,
        body: input.body,
      },
      { onConflict: "location_id,user_id" }
    )
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function addReviewPhoto(client: SupabaseClient, reviewId: string, storagePath: string): Promise<void> {
  const { error } = await client.from("review_photos").insert({ review_id: reviewId, storage_path: storagePath });
  if (error) throw error;
}

export type ReviewPhoto = {
  id: string;
  storagePath: string;
  url: string;
};

export async function fetchReviewPhotos(client: SupabaseClient, reviewId: string): Promise<ReviewPhoto[]> {
  const { data, error } = await client.from("review_photos").select("id, storage_path").eq("review_id", reviewId);
  if (error) throw error;

  return ((data ?? []) as { id: string; storage_path: string }[]).map((row) => ({
    id: row.id,
    storagePath: row.storage_path,
    url: client.storage.from("media").getPublicUrl(row.storage_path).data.publicUrl,
  }));
}

export async function deleteReviewPhoto(client: SupabaseClient, photo: ReviewPhoto): Promise<void> {
  const { error } = await client.from("review_photos").delete().eq("id", photo.id);
  if (error) throw error;
  // Best-effort storage cleanup — the row is what controls display, so an
  // orphaned object here shouldn't fail the user's save.
  await client.storage.from("media").remove([photo.storagePath]);
}

export type ReviewReportInput = {
  reviewId: string;
  reporterId: string;
  reason: string;
  details: string | null;
};

export async function reportReview(client: SupabaseClient, input: ReviewReportInput): Promise<void> {
  const { error } = await client.from("review_reports").insert({
    review_id: input.reviewId,
    reporter_id: input.reporterId,
    reason: input.reason,
    details: input.details,
  });
  if (error) throw error;
}

/**
 * Deletes a review outright. For the author removing their own.
 *
 * The photos and likes go with it by cascade, and the location's rating is
 * recalculated by trigger. A moderator taking something down should use
 * `setReviewStatus` instead — see the note there.
 */
export async function deleteReview(client: SupabaseClient, reviewId: string): Promise<void> {
  const { error } = await client.from("reviews").delete().eq("id", reviewId);
  if (error) throw error;
}

/**
 * Hides or removes a review as a moderator.
 *
 * Deliberately not a delete. 'removed' is reversible, and a trigger writes
 * every status change to `moderation_actions` — destroying a harmful comment
 * outright would also destroy the record that it was ever posted, which is the
 * thing you most want to keep. Only the author gets to erase their own words.
 */
export async function setReviewStatus(
  client: SupabaseClient,
  reviewId: string,
  status: "visible" | "hidden" | "removed"
): Promise<void> {
  const { error } = await client.from("reviews").update({ status }).eq("id", reviewId);
  if (error) throw error;
}
