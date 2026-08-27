import type { SupabaseClient } from "@supabase/supabase-js";

export type CrashReport = {
  appRelease: string;
  platform: "ios" | "android" | "web";
  osVersion?: string | null;
  route?: string | null;
  message: string;
  stack?: string | null;
  isFatal?: boolean;
};

/**
 * Records that the app broke.
 *
 * Never throws. This is called from a global error handler, and a reporter that
 * can fail while reporting a failure turns one crash into two — the second one
 * unreportable by definition.
 *
 * Deliberately carries nothing that identifies a person: the Privacy Policy
 * does not mention diagnostics, and adding a user id here would quietly make it
 * inaccurate. The table's columns are capped, so anything longer is trimmed
 * here rather than rejected by the database and lost.
 */
export async function reportCrash(client: SupabaseClient, input: CrashReport): Promise<void> {
  try {
    await client.from("crash_reports").insert({
      app_release: input.appRelease.slice(0, 32),
      platform: input.platform,
      os_version: input.osVersion?.slice(0, 64) ?? null,
      route: input.route?.slice(0, 200) ?? null,
      message: input.message.slice(0, 2000),
      stack: input.stack?.slice(0, 8000) ?? null,
      is_fatal: input.isFatal ?? true,
    });
  } catch {
    // Swallowed on purpose. See above.
  }
}

export type CrashReportRow = {
  id: string;
  createdAt: string;
  appRelease: string;
  platform: string;
  osVersion: string | null;
  route: string | null;
  message: string;
  stack: string | null;
  isFatal: boolean;
};

/**
 * Recent crashes, newest first. Moderators only — RLS enforces that, this just
 * asks.
 *
 * Capped rather than paged: the useful question is "is anything breaking right
 * now", and if two hundred reports are not enough to answer it, the answer is
 * yes and the detail is in the repetition.
 */
/**
 * How many crashes have arrived since `since`, for the Admin menu badge.
 *
 * `crash_reports` has no read or resolved column — a crash is a fact, not a
 * task — so "new" can only mean "since this admin last opened the screen",
 * which the app remembers on the device. A null `since` means it never has,
 * and every report counts as new.
 */
export async function fetchCrashCountSince(
  client: SupabaseClient,
  since: string | null
): Promise<number> {
  let query = client.from("crash_reports").select("*", { count: "exact", head: true });
  if (since) query = query.gt("created_at", since);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function fetchCrashReports(client: SupabaseClient, limit = 200): Promise<CrashReportRow[]> {
  const { data, error } = await client
    .from("crash_reports")
    .select("id, created_at, app_release, platform, os_version, route, message, stack, is_fatal")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    createdAt: row.created_at as string,
    appRelease: row.app_release as string,
    platform: row.platform as string,
    osVersion: (row.os_version as string) ?? null,
    route: (row.route as string) ?? null,
    message: row.message as string,
    stack: (row.stack as string) ?? null,
    isFatal: row.is_fatal as boolean,
  }));
}
