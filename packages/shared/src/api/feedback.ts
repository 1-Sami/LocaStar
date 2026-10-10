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
  /** When somebody marked it handled, or null while it is still open. */
  doneAt: string | null;
  /** Who is dealing with it. Never who sent it — feedback has no sender. */
  assignedTo: string | null;
  assignedToName: string | null;
};

/** Somebody a piece of feedback can be handed to. */
export type FeedbackAssignee = { id: string; name: string; role: string };

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
    .select(
      "id, created_at, category, message, app_release, platform, done_at, assigned_to, assignee:profiles!feedback_assigned_to_fkey(username, display_name)"
    )
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
    doneAt: (row.done_at as string | null) ?? null,
    assignedTo: (row.assigned_to as string | null) ?? null,
    assignedToName: assigneeName(row.assignee),
  }));
}

/*
 * PostgREST types a to-one embed as an array, and returns the single row it is.
 * Cast at the boundary, the way the rest of these files do.
 */
function assigneeName(embed: unknown): string | null {
  const row = (Array.isArray(embed) ? embed[0] : embed) as
    | { username?: string | null; display_name?: string | null }
    | null
    | undefined;
  if (!row) return null;
  return row.username ?? row.display_name ?? null;
}

/**
 * Handled, or back in the queue.
 *
 * An assignee may close their own item; an admin may close any. RLS decides
 * which — see migration 0160, where both halves of the assignee policy pin
 * assigned_to to themselves so closing cannot double as taking.
 */
export async function setFeedbackDone(
  client: SupabaseClient,
  id: string,
  done: boolean
): Promise<void> {
  const { error } = await client
    .from("feedback")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}

/** Hand it to somebody, or take it back. Admins only, enforced by RLS. */
export async function setFeedbackAssignee(
  client: SupabaseClient,
  id: string,
  assignedTo: string | null
): Promise<void> {
  const { error } = await client.from("feedback").update({ assigned_to: assignedTo }).eq("id", id);
  if (error) throw error;
}

export async function deleteFeedback(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("feedback").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Who a piece of feedback can be given to.
 *
 * Admins and superusers, because those are the roles that can read it once it
 * is theirs. A plain user assigned something would see nothing: the policy in
 * 0160 lets an assignee read their own rows, but nothing grants the rest.
 */
export async function fetchFeedbackAssignees(client: SupabaseClient): Promise<FeedbackAssignee[]> {
  const { data, error } = await client
    .from("profiles")
    .select("id, username, display_name, role")
    .in("role", ["admin", "superuser"])
    .order("username");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    name: (row.username as string | null) ?? (row.display_name as string | null) ?? "—",
    role: row.role as string,
  }));
}
