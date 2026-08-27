import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Product feedback: ideas, feature requests, and requests to take something
 * away. Not support — account trouble and faults go to the support address,
 * which is the only channel that can answer, because none of this can.
 */
export type FeedbackCategory = "general" | "feature_request" | "feature_removal";

/**
 * Stored in English whatever language the sender is using. Translating the
 * value would file a Swedish "Önska en funktion" and an English "Request a
 * feature" as two different things; the labels are translated, these are not.
 */
export const FEEDBACK_CATEGORIES: FeedbackCategory[] = [
  "general",
  "feature_request",
  "feature_removal",
];

/** Matches the check constraint on feedback.message in migration 0120. */
export const FEEDBACK_MAX_LENGTH = 2000;

/** Matches the cap enforced inside submit_feedback(). */
export const FEEDBACK_DAILY_LIMIT = 5;

export type FeedbackInput = {
  category: FeedbackCategory;
  message: string;
  appRelease: string;
  platform: "ios" | "android" | "web";
};

/**
 * Thrown when the account has used up the day's allowance.
 *
 * Worth separating from every other failure because it is the one the sender
 * can do something about, and "try again tomorrow" is a very different message
 * from "that didn't send".
 */
export class FeedbackDailyLimitReached extends Error {
  constructor() {
    super(`No more than ${FEEDBACK_DAILY_LIMIT} feedback messages a day`);
    this.name = "FeedbackDailyLimitReached";
  }
}

/**
 * Sends one piece of feedback.
 *
 * Goes through the submit_feedback() RPC rather than inserting, and that is
 * load-bearing rather than stylistic: `feedback` has no insert policy at all,
 * so an insert from here would simply be refused. The RPC is what enforces the
 * daily cap and the ban check, and routing around it is the one thing that
 * would make the sign-in requirement meaningless.
 *
 * Nothing identifying is sent. Being signed in is checked inside the function
 * and never recorded — see the header of migration 0120.
 */
export async function submitFeedback(client: SupabaseClient, input: FeedbackInput): Promise<void> {
  const { error } = await client.rpc("submit_feedback", {
    p_category: input.category,
    p_message: input.message,
    p_app_release: input.appRelease,
    p_platform: input.platform,
  });
  if (error) {
    // 54000 is raised by submit_feedback() for the daily cap and nothing else.
    if (error.code === "54000") throw new FeedbackDailyLimitReached();
    throw error;
  }
}

export type FeedbackRow = {
  id: string;
  createdAt: string;
  category: FeedbackCategory;
  message: string;
  appRelease: string;
  platform: string;
};

/**
 * The queue, newest first. Admins only — RLS enforces that, this just asks.
 *
 * Capped rather than paged, like crash reports: this is a pile to read
 * through, and if two hundred is not enough to see what people keep asking
 * for, the repetition is itself the answer.
 */
/**
 * How much feedback has arrived since `since`, for the Admin menu badge.
 *
 * Same shape as the crash count, and for the same reason: `feedback` has no
 * read column, deliberately — the table carries nothing about who sent what,
 * so per-admin state cannot live on the row. It lives on the device instead.
 */
export async function fetchFeedbackCountSince(
  client: SupabaseClient,
  since: string | null
): Promise<number> {
  let query = client.from("feedback").select("*", { count: "exact", head: true });
  if (since) query = query.gt("created_at", since);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function fetchFeedback(client: SupabaseClient, limit = 200): Promise<FeedbackRow[]> {
  const { data, error } = await client
    .from("feedback")
    .select("id, created_at, category, message, app_release, platform")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    createdAt: row.created_at as string,
    category: row.category as FeedbackCategory,
    message: row.message as string,
    appRelease: row.app_release as string,
    platform: row.platform as string,
  }));
}
