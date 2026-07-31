import type { SupabaseClient } from "@supabase/supabase-js";

import type { UserRole } from "./profile";

export type LocationReportStatus = "open" | "reviewed" | "actioned" | "dismissed";
export type LocationStatus = "pending" | "active" | "flagged" | "removed";

/** What the moderator actually decided, recorded rather than inferred. */
export type ResolutionAction = "dismissed" | "warned" | "hidden" | "removed";

export type LocationReport = {
  id: string;
  locationId: string;
  locationName: string;
  locationStatus: LocationStatus;
  /** Who added the location — lets a moderator act on the person, not just the listing. */
  locationCreatorId: string | null;
  locationCreatorName: string;
  reason: string;
  details: string | null;
  reporterName: string;
  status: LocationReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolutionAction: ResolutionAction | null;
  resolutionNote: string | null;
};

type LocationReportRow = {
  id: string;
  location_id: string;
  reason: string;
  details: string | null;
  status: LocationReportStatus;
  created_at: string;
  resolved_at: string | null;
  resolution_action: ResolutionAction | null;
  resolution_note: string | null;
  locations: {
    name: string;
    status: LocationStatus;
    created_by: string | null;
    profiles: { username: string | null; display_name: string | null } | null;
  } | null;
  profiles: { username: string | null; display_name: string | null } | null;
};

const LOCATION_REPORT_SELECT =
  // `locations` has two FKs to `profiles` (created_by and claimed_by), so the
  // nested embed must name the constraint — an unqualified profiles(...) here
  // is ambiguous and makes PostgREST reject the whole query.
  "id, location_id, reason, details, status, created_at, resolved_at, resolution_action, resolution_note, locations(name, status, created_by, profiles!locations_created_by_fkey(username, display_name)), profiles!location_reports_reporter_id_fkey(username, display_name)";

function mapLocationReport(row: LocationReportRow): LocationReport {
  return {
    id: row.id,
    locationId: row.location_id,
    locationName: row.locations?.name ?? "Unknown location",
    locationStatus: row.locations?.status ?? "active",
    locationCreatorId: row.locations?.created_by ?? null,
    locationCreatorName: row.locations?.profiles?.username ?? row.locations?.profiles?.display_name ?? "Unknown",
    reason: row.reason,
    details: row.details,
    reporterName: row.profiles?.username ?? row.profiles?.display_name ?? "Anonymous",
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    resolutionAction: row.resolution_action,
    resolutionNote: row.resolution_note,
  };
}

export async function fetchOpenLocationReports(client: SupabaseClient): Promise<LocationReport[]> {
  const { data, error } = await client
    .from("location_reports")
    .select(LOCATION_REPORT_SELECT)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as LocationReportRow[]).map(mapLocationReport);
}

export async function fetchHandledLocationReports(client: SupabaseClient): Promise<LocationReport[]> {
  const { data, error } = await client
    .from("location_reports")
    .select(LOCATION_REPORT_SELECT)
    .neq("status", "open")
    .order("resolved_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as LocationReportRow[]).map(mapLocationReport);
}

export async function resolveLocationReport(
  client: SupabaseClient,
  reportId: string,
  status: LocationReportStatus,
  resolvedBy: string,
  action: ResolutionAction,
  note: string
): Promise<void> {
  const { error } = await client
    .from("location_reports")
    .update({
      status,
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
      resolution_action: action,
      resolution_note: note,
    })
    .eq("id", reportId);
  if (error) throw error;
}

export async function updateLocationStatus(
  client: SupabaseClient,
  locationId: string,
  status: LocationStatus
): Promise<void> {
  const { error } = await client.from("locations").update({ status }).eq("id", locationId);
  if (error) throw error;
}

export type ReviewStatus = "visible" | "hidden" | "removed";

export type ReviewReport = {
  id: string;
  reviewId: string;
  reviewAuthorId: string | null;
  reviewAuthorName: string;
  reviewRating: number;
  reviewTitle: string | null;
  reviewBody: string | null;
  reviewStatus: ReviewStatus;
  locationId: string;
  locationName: string;
  reason: string;
  details: string | null;
  reporterName: string;
  status: LocationReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolutionAction: ResolutionAction | null;
  resolutionNote: string | null;
};

type ReviewReportRow = {
  id: string;
  review_id: string;
  reason: string;
  details: string | null;
  status: LocationReportStatus;
  created_at: string;
  resolved_at: string | null;
  resolution_action: ResolutionAction | null;
  resolution_note: string | null;
  reviews: {
    rating: number;
    title: string | null;
    body: string | null;
    status: ReviewStatus;
    location_id: string;
    user_id: string;
    profiles: { username: string | null; display_name: string | null } | null;
    locations: { name: string } | null;
  } | null;
  profiles: { username: string | null; display_name: string | null } | null;
};

const REVIEW_REPORT_SELECT =
  "id, review_id, reason, details, status, created_at, resolved_at, resolution_action, resolution_note, reviews(rating, title, body, status, location_id, user_id, profiles(username, display_name), locations(name)), profiles!review_reports_reporter_id_fkey(username, display_name)";

function mapReviewReport(row: ReviewReportRow): ReviewReport {
  return {
    id: row.id,
    reviewId: row.review_id,
    reviewAuthorId: row.reviews?.user_id ?? null,
    reviewAuthorName: row.reviews?.profiles?.username ?? row.reviews?.profiles?.display_name ?? "Anonymous",
    reviewRating: row.reviews?.rating ?? 0,
    reviewTitle: row.reviews?.title ?? null,
    reviewBody: row.reviews?.body ?? null,
    reviewStatus: row.reviews?.status ?? "visible",
    locationId: row.reviews?.location_id ?? "",
    locationName: row.reviews?.locations?.name ?? "Unknown location",
    reason: row.reason,
    details: row.details,
    reporterName: row.profiles?.username ?? row.profiles?.display_name ?? "Anonymous",
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    resolutionAction: row.resolution_action,
    resolutionNote: row.resolution_note,
  };
}

export async function fetchOpenReviewReports(client: SupabaseClient): Promise<ReviewReport[]> {
  const { data, error } = await client
    .from("review_reports")
    .select(REVIEW_REPORT_SELECT)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as ReviewReportRow[]).map(mapReviewReport);
}

export async function fetchHandledReviewReports(client: SupabaseClient): Promise<ReviewReport[]> {
  const { data, error } = await client
    .from("review_reports")
    .select(REVIEW_REPORT_SELECT)
    .neq("status", "open")
    .order("resolved_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as ReviewReportRow[]).map(mapReviewReport);
}

export async function resolveReviewReport(
  client: SupabaseClient,
  reportId: string,
  status: LocationReportStatus,
  resolvedBy: string,
  action: ResolutionAction,
  note: string
): Promise<void> {
  const { error } = await client
    .from("review_reports")
    .update({
      status,
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
      resolution_action: action,
      resolution_note: note,
    })
    .eq("id", reportId);
  if (error) throw error;
}

export async function fetchOpenReportsCount(client: SupabaseClient): Promise<number> {
  const [locationReports, reviewReports, businessClaims] = await Promise.all([
    client.from("location_reports").select("*", { count: "exact", head: true }).eq("status", "open"),
    client.from("review_reports").select("*", { count: "exact", head: true }).eq("status", "open"),
    client.from("business_claims").select("*", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  if (locationReports.error) throw locationReports.error;
  if (reviewReports.error) throw reviewReports.error;
  if (businessClaims.error) throw businessClaims.error;
  return (locationReports.count ?? 0) + (reviewReports.count ?? 0) + (businessClaims.count ?? 0);
}

export async function updateReviewStatus(
  client: SupabaseClient,
  reviewId: string,
  status: ReviewStatus
): Promise<void> {
  const { error } = await client.from("reviews").update({ status }).eq("id", reviewId);
  if (error) throw error;
}

/* ---------------------------------------------------------------- bans --- */

export type BanStatus = "pending" | "active" | "reversed" | "lifted";

export type UserBan = {
  id: string;
  userId: string;
  userName: string;
  issuedById: string | null;
  issuedByName: string;
  reason: string;
  /** null means a lifetime ban */
  expiresAt: string | null;
  status: BanStatus;
  reviewNote: string | null;
  createdAt: string;
};

type UserBanRow = {
  id: string;
  user_id: string;
  issued_by: string | null;
  reason: string;
  expires_at: string | null;
  status: BanStatus;
  review_note: string | null;
  created_at: string;
  banned: { display_name: string | null; username: string | null } | null;
  issuer: { display_name: string | null; username: string | null } | null;
};

const BAN_SELECT =
  "id, user_id, issued_by, reason, expires_at, status, review_note, created_at, " +
  "banned:profiles!user_bans_user_id_fkey(display_name, username), " +
  "issuer:profiles!user_bans_issued_by_fkey(display_name, username)";

// Username first: accounts created with only an email have no display_name, so
// preferring display_name rendered them as "Unknown".
function personName(p: { display_name: string | null; username: string | null } | null): string {
  return p?.username ?? p?.display_name ?? "Unknown";
}

function mapBan(row: UserBanRow): UserBan {
  return {
    id: row.id,
    userId: row.user_id,
    userName: personName(row.banned),
    issuedById: row.issued_by,
    issuedByName: personName(row.issuer),
    reason: row.reason,
    expiresAt: row.expires_at,
    status: row.status,
    reviewNote: row.review_note,
    createdAt: row.created_at,
  };
}

/**
 * Issues a ban. A superuser's ban lands as "pending" and takes effect straight
 * away; an admin still has to validate it. Admins issue "active" directly.
 */
export async function issueBan(
  client: SupabaseClient,
  input: {
    userId: string;
    issuedBy: string;
    reason: string;
    /** null = lifetime */
    expiresAt: string | null;
    asAdmin: boolean;
  }
): Promise<void> {
  const { error } = await client.from("user_bans").insert({
    user_id: input.userId,
    issued_by: input.issuedBy,
    reason: input.reason,
    expires_at: input.expiresAt,
    status: input.asAdmin ? "active" : "pending",
  });
  if (error) throw error;
}

export async function fetchBansByStatus(
  client: SupabaseClient,
  statuses: BanStatus[]
): Promise<UserBan[]> {
  const { data, error } = await client
    .from("user_bans")
    .select(BAN_SELECT)
    .in("status", statuses)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as UserBanRow[]).map(mapBan);
}

/** Admin-only: confirm, reverse or lift a ban. */
export async function reviewBan(
  client: SupabaseClient,
  banId: string,
  status: Exclude<BanStatus, "pending">,
  reviewedBy: string,
  note: string | null
): Promise<void> {
  const { error } = await client
    .from("user_bans")
    .update({ status, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString(), review_note: note })
    .eq("id", banId);
  if (error) throw error;
}

/** The signed-in user's restriction, if any — drives the banned notice. */
export async function fetchMyActiveBan(client: SupabaseClient, userId: string): Promise<UserBan | null> {
  const { data, error } = await client
    .from("user_bans")
    .select(BAN_SELECT)
    .eq("user_id", userId)
    .in("status", ["pending", "active"])
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as UserBanRow[];
  const live = rows.find((row) => !row.expires_at || new Date(row.expires_at) > new Date());
  return live ? mapBan(live) : null;
}

/* --------------------------------------------------------------- roles --- */

export type ManagedUser = {
  id: string;
  name: string;
  username: string | null;
  role: UserRole;
  isBanned: boolean;
};

export async function searchUsers(client: SupabaseClient, query: string): Promise<ManagedUser[]> {
  const trimmed = query.trim();
  let request = client.from("profiles").select("id, display_name, username, role").limit(25);
  if (trimmed) {
    request = request.or(`username.ilike.%${trimmed}%,display_name.ilike.%${trimmed}%`);
  }
  const { data, error } = await request;
  if (error) throw error;

  const rows = (data ?? []) as { id: string; display_name: string | null; username: string | null; role: UserRole }[];
  if (rows.length === 0) return [];

  const { data: banRows, error: banError } = await client
    .from("user_bans")
    .select("user_id, expires_at")
    .in("status", ["pending", "active"])
    .in("user_id", rows.map((r) => r.id));
  if (banError) throw banError;

  const now = new Date();
  const banned = new Set(
    ((banRows ?? []) as { user_id: string; expires_at: string | null }[])
      .filter((b) => !b.expires_at || new Date(b.expires_at) > now)
      .map((b) => b.user_id)
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.username ?? row.display_name ?? "Unknown",
    username: row.username,
    role: row.role,
    isBanned: banned.has(row.id),
  }));
}

/** Admin-only: grant or revoke the superuser (moderator) badge. */
export async function setUserRole(client: SupabaseClient, userId: string, role: UserRole): Promise<void> {
  const { error } = await client.from("profiles").update({ role }).eq("id", userId);
  if (error) throw error;
}

/* ----------------------------------------------------------- audit log --- */

export type ModerationAction = {
  id: string;
  actorName: string;
  actorRole: UserRole | null;
  action: string;
  targetType: string;
  targetId: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
};

export async function fetchModerationActions(
  client: SupabaseClient,
  limit = 100
): Promise<ModerationAction[]> {
  const { data, error } = await client
    .from("moderation_actions")
    .select("id, actor_role, action, target_type, target_id, detail, created_at, actor:profiles(display_name, username)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (
    (data ?? []) as unknown as {
      id: string;
      actor_role: UserRole | null;
      action: string;
      target_type: string;
      target_id: string | null;
      detail: Record<string, unknown> | null;
      created_at: string;
      actor: { display_name: string | null; username: string | null } | null;
    }[]
  ).map((row) => ({
    id: row.id,
    actorName: personName(row.actor),
    actorRole: row.actor_role,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    detail: row.detail,
    createdAt: row.created_at,
  }));
}

/* ------------------------------------------------------------ warnings --- */

export type UserWarning = {
  id: string;
  userId: string;
  issuedByName: string;
  reason: string;
  acknowledgedAt: string | null;
  createdAt: string;
};

type UserWarningRow = {
  id: string;
  user_id: string;
  reason: string;
  acknowledged_at: string | null;
  created_at: string;
  issuer: { display_name: string | null; username: string | null } | null;
};

const WARNING_SELECT =
  "id, user_id, reason, acknowledged_at, created_at, issuer:profiles!user_warnings_issued_by_fkey(display_name, username)";

function mapWarning(row: UserWarningRow): UserWarning {
  return {
    id: row.id,
    userId: row.user_id,
    issuedByName: personName(row.issuer),
    reason: row.reason,
    acknowledgedAt: row.acknowledged_at,
    createdAt: row.created_at,
  };
}

export async function issueWarning(
  client: SupabaseClient,
  input: {
    userId: string;
    issuedBy: string;
    reason: string;
    targetType?: string | null;
    targetId?: string | null;
  }
): Promise<void> {
  const { error } = await client.from("user_warnings").insert({
    user_id: input.userId,
    issued_by: input.issuedBy,
    reason: input.reason,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
  });
  if (error) throw error;
}

export async function fetchWarningsForUser(client: SupabaseClient, userId: string): Promise<UserWarning[]> {
  const { data, error } = await client
    .from("user_warnings")
    .select(WARNING_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as UserWarningRow[]).map(mapWarning);
}

/** Recipients can only mark a warning as seen — the rest of the row is pinned by a trigger. */
export async function acknowledgeWarning(client: SupabaseClient, warningId: string): Promise<void> {
  const { error } = await client
    .from("user_warnings")
    .update({ acknowledged_at: new Date().toISOString() })
    .eq("id", warningId);
  if (error) throw error;
}
