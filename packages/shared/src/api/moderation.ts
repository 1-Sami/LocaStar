import type { SupabaseClient } from "@supabase/supabase-js";

import { DELETED_ACCOUNT_NAME } from "./profile";
import type { UserRole } from "./profile";

export type LocationReportStatus = "open" | "reviewed" | "actioned" | "dismissed";
export type LocationStatus = "pending" | "active" | "flagged" | "past" | "removed";

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
  /**
   * The one photo this report is about, or null when it is about the listing.
   *
   * photoPath rather than a URL: building one needs the storage client, which
   * the screen has and this module deliberately does not.
   */
  photoId: string | null;
  photoPath: string | null;
  /** When it was removed, for the countdown. Null unless removed. */
  removedAt: string | null;
  reason: string;
  details: string | null;
  reporterName: string;
  status: LocationReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolutionAction: ResolutionAction | null;
  resolutionNote: string | null;
  /** Filed automatically by a block rather than chosen — see migration 0123. */
  fromBlock: boolean;
};

type LocationReportRow = {
  id: string;
  location_id: string;
  location_photo_id: string | null;
  location_photos: { storage_path: string } | null;
  reason: string;
  details: string | null;
  status: LocationReportStatus;
  created_at: string;
  resolved_at: string | null;
  resolution_action: ResolutionAction | null;
  resolution_note: string | null;
  from_block: boolean | null;
  locations: {
    name: string;
    status: LocationStatus;
    removed_at: string | null;
    created_by: string | null;
    profiles: { username: string | null; display_name: string | null } | null;
  } | null;
  profiles: { username: string | null; display_name: string | null } | null;
};

const LOCATION_REPORT_SELECT =
  // `locations` has two FKs to `profiles` (created_by and claimed_by), so the
  // nested embed must name the constraint — an unqualified profiles(...) here
  // is ambiguous and makes PostgREST reject the whole query.
  "id, location_id, location_photo_id, reason, details, status, created_at, resolved_at, resolution_action, resolution_note, from_block, location_photos(storage_path), locations(name, status, removed_at, created_by, profiles!locations_created_by_fkey(username, display_name)), profiles!location_reports_reporter_id_fkey(username, display_name)";

function mapLocationReport(row: LocationReportRow): LocationReport {
  return {
    id: row.id,
    locationId: row.location_id,
    locationName: row.locations?.name ?? "Unknown location",
    locationStatus: row.locations?.status ?? "active",
    locationCreatorId: row.locations?.created_by ?? null,
    removedAt: row.locations?.removed_at ?? null,
    photoId: row.location_photo_id ?? null,
    photoPath: row.location_photos?.storage_path ?? null,
    locationCreatorName: row.locations?.profiles?.username ?? row.locations?.profiles?.display_name ?? "Unknown",
    reason: row.reason,
    details: row.details,
    reporterName: row.profiles?.username ?? row.profiles?.display_name ?? "Anonymous",
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    resolutionAction: row.resolution_action,
    resolutionNote: row.resolution_note,
    fromBlock: row.from_block ?? false,
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


/**
 * Puts a held photo back on display, for a moderator who judged it fine.
 *
 * Through an RPC rather than a direct update: location_photos already lets its
 * uploader update the row, so clearing the hold that way would let the person
 * who posted the photo undo the hold on their own photo. review_photos allows
 * no updates at all. The function checks is_moderator() itself.
 */
export async function releasePhotoHold(
  client: SupabaseClient,
  photo: { locationPhotoId?: string | null; reviewPhotoId?: string | null }
): Promise<void> {
  const { error } = await client.rpc("release_photo_hold", {
    p_location_photo_id: photo.locationPhotoId ?? null,
    p_review_photo_id: photo.reviewPhotoId ?? null,
  });
  if (error) throw error;
}

/**
 * Moves a photo to the trash, or takes it back out.
 *
 * Replaces the hard delete this used to be. A moderator who removes the wrong
 * picture now has thirty days to notice, and the stored object stays until the
 * purge so a restore has something to restore.
 */
export async function setPhotoRemoved(
  client: SupabaseClient,
  photo: { locationPhotoId?: string | null; reviewPhotoId?: string | null },
  removed: boolean
): Promise<void> {
  const { error } = await client.rpc("set_photo_removed", {
    p_location_photo_id: photo.locationPhotoId ?? null,
    p_review_photo_id: photo.reviewPhotoId ?? null,
    p_removed: removed,
  });
  if (error) throw error;
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
  // removed_at is the purge clock, and it is stamped and cleared here so a
  // restore genuinely takes the row out of the trash rather than leaving it
  // visible with a countdown still running underneath it.
  const { error } = await client
    .from("locations")
    .update({ status, removed_at: status === "removed" ? new Date().toISOString() : null })
    .eq("id", locationId);
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
  /** The one photo this report is about, or null when it is about the review. */
  photoId: string | null;
  photoPath: string | null;
  /** When it was removed, for the countdown. Null unless removed. */
  removedAt: string | null;
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
  /** Filed automatically by a block rather than chosen — see migration 0123. */
  fromBlock: boolean;
};

type ReviewReportRow = {
  id: string;
  review_id: string;
  review_photo_id: string | null;
  review_photos: { storage_path: string } | null;
  reason: string;
  details: string | null;
  status: LocationReportStatus;
  created_at: string;
  resolved_at: string | null;
  resolution_action: ResolutionAction | null;
  resolution_note: string | null;
  from_block: boolean | null;
  reviews: {
    rating: number;
    title: string | null;
    body: string | null;
    status: ReviewStatus;
    removed_at: string | null;
    location_id: string;
    user_id: string;
    profiles: { username: string | null; display_name: string | null } | null;
    locations: { name: string } | null;
  } | null;
  profiles: { username: string | null; display_name: string | null } | null;
};

const REVIEW_REPORT_SELECT =
  "id, review_id, review_photo_id, reason, details, status, created_at, resolved_at, resolution_action, resolution_note, from_block, review_photos(storage_path), reviews(rating, title, body, status, removed_at, location_id, user_id, profiles(username, display_name), locations(name)), profiles!review_reports_reporter_id_fkey(username, display_name)";

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
    removedAt: row.reviews?.removed_at ?? null,
    photoId: row.review_photo_id ?? null,
    photoPath: row.review_photos?.storage_path ?? null,
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
    fromBlock: row.from_block ?? false,
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

export type ListReport = {
  id: string;
  listId: string;
  listName: string;
  listDescription: string | null;
  listIsPublic: boolean;
  ownerId: string | null;
  ownerName: string;
  reason: string;
  details: string | null;
  reporterName: string;
  status: LocationReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolutionAction: ResolutionAction | null;
  resolutionNote: string | null;
  /** Filed automatically by a block rather than chosen — see migration 0123. */
  fromBlock: boolean;
};

type ListReportRow = {
  id: string;
  list_id: string;
  reason: string;
  details: string | null;
  status: LocationReportStatus;
  created_at: string;
  resolved_at: string | null;
  resolution_action: ResolutionAction | null;
  resolution_note: string | null;
  from_block: boolean | null;
  lists: {
    name: string;
    description: string | null;
    is_public: boolean;
    user_id: string | null;
    owner: { username: string | null; display_name: string | null } | null;
  } | null;
  profiles: { username: string | null; display_name: string | null } | null;
};

const LIST_REPORT_SELECT =
  "id, list_id, reason, details, status, created_at, resolved_at, resolution_action, resolution_note, from_block, lists(name, description, is_public, user_id, owner:profiles!lists_user_id_fkey(username, display_name)), profiles!list_reports_reporter_id_fkey(username, display_name)";

function mapListReport(row: ListReportRow): ListReport {
  return {
    id: row.id,
    listId: row.list_id,
    // A deleted list cascades its reports away, so a null here means the row
    // was read mid-delete rather than that the list was nameless.
    listName: row.lists?.name ?? "Deleted list",
    listDescription: row.lists?.description ?? null,
    listIsPublic: row.lists?.is_public ?? false,
    ownerId: row.lists?.user_id ?? null,
    ownerName: row.lists?.owner?.username ?? row.lists?.owner?.display_name ?? "Anonymous",
    reason: row.reason,
    details: row.details,
    reporterName: row.profiles?.username ?? row.profiles?.display_name ?? "Anonymous",
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    resolutionAction: row.resolution_action,
    resolutionNote: row.resolution_note,
    fromBlock: row.from_block ?? false,
  };
}

export async function fetchOpenListReports(client: SupabaseClient): Promise<ListReport[]> {
  const { data, error } = await client
    .from("list_reports")
    .select(LIST_REPORT_SELECT)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as ListReportRow[]).map(mapListReport);
}

export async function fetchHandledListReports(client: SupabaseClient): Promise<ListReport[]> {
  const { data, error } = await client
    .from("list_reports")
    .select(LIST_REPORT_SELECT)
    .neq("status", "open")
    .order("resolved_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as ListReportRow[]).map(mapListReport);
}

export async function resolveListReport(
  client: SupabaseClient,
  reportId: string,
  status: LocationReportStatus,
  resolvedBy: string,
  action: ResolutionAction,
  note: string
): Promise<void> {
  const { error } = await client
    .from("list_reports")
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
  const [locationReports, reviewReports, listReports, businessClaims] = await Promise.all([
    client.from("location_reports").select("*", { count: "exact", head: true }).eq("status", "open"),
    client.from("review_reports").select("*", { count: "exact", head: true }).eq("status", "open"),
    client.from("list_reports").select("*", { count: "exact", head: true }).eq("status", "open"),
    client.from("business_claims").select("*", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  if (locationReports.error) throw locationReports.error;
  if (reviewReports.error) throw reviewReports.error;
  if (listReports.error) throw listReports.error;
  if (businessClaims.error) throw businessClaims.error;
  return (
    (locationReports.count ?? 0) +
    (reviewReports.count ?? 0) +
    (listReports.count ?? 0) +
    (businessClaims.count ?? 0)
  );
}

export async function updateReviewStatus(
  client: SupabaseClient,
  reviewId: string,
  status: ReviewStatus
): Promise<void> {
  const { error } = await client
    .from("reviews")
    .update({ status, removed_at: status === "removed" ? new Date().toISOString() : null })
    .eq("id", reviewId);
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
  // A missing row means the account was deleted and its contributions kept
  // (0071); "Unknown" is for a profile that is present but unnamed.
  if (!p) return DELETED_ACCOUNT_NAME;
  return p.username ?? p.display_name ?? "Unknown";
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

/**
 * Find someone to moderate, by handle, display name or email address.
 *
 * Goes through `moderator_search_users` rather than querying `profiles`
 * directly, for one reason: email. It lives in `auth.users`, and `profiles`
 * deliberately does not carry it — see migration 0066 — so the only way to
 * match on it without publishing addresses is inside a security-definer
 * function. That function checks `is_moderator()` itself, matches email by
 * equality so the field cannot be used to enumerate addresses, and never
 * returns the address it matched.
 *
 * Returns nothing for a query shorter than two characters. The screen used to
 * list every account when the box was empty, which handed the whole member
 * directory to anyone made a superuser.
 */
export async function searchUsers(client: SupabaseClient, query: string): Promise<ManagedUser[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const { data, error } = await client.rpc("moderator_search_users", { search_query: trimmed });
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
  /**
   * Usernames for any account id mentioned in `detail`, resolved when the log
   * is read.
   *
   * The log deliberately stores ids: a display name can change afterwards, and
   * the entry has to keep meaning what it meant. But a screen showing
   * "author: cfe37315-2987-43e9…" is a record nobody can act on, so the names
   * are looked up now and the ids are kept underneath.
   */
  names: Record<string, string>;
  /**
   * What the entry is about, in words: "a review by sadek2 on Test location 1".
   *
   * Resolved when the log is read, from the target id the entry stored. Null
   * when the row it named has since been deleted — which is a fact worth
   * showing rather than hiding, and the reason ids are stored and not names.
   */
  subject: string | null;
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

  const rows = (
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
    names: {},
    subject: null,
    actorRole: row.actor_role,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    detail: row.detail,
    createdAt: row.created_at,
  }));

  const ids = new Set<string>();
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const entry of rows) {
    for (const value of Object.values(entry.detail ?? {})) {
      if (typeof value === "string" && UUID.test(value)) ids.add(value);
    }
  }
  if (ids.size === 0) return rows;

  const { data: people } = await client
    .from("profiles")
    .select("id, username, display_name")
    .in("id", [...ids]);

  const names: Record<string, string> = {};
  for (const person of (people ?? []) as { id: string; username: string | null; display_name: string | null }[]) {
    names[person.id] = person.username ?? person.display_name ?? "Anonymous";
  }
  // An id with no profile behind it belonged to somebody who has since deleted
  // their account. Saying so is more use than printing the id.
  for (const id of ids) if (!names[id]) names[id] = DELETED_ACCOUNT_NAME;

  const subjects = await resolveSubjects(client, rows);
  return rows.map((entry) => ({ ...entry, names, subject: subjects.get(entry.id) ?? null }));
}

/**
 * Turns each entry's target id into something a person can read.
 *
 * Chases the chain the log does not store: a report points at a review, a
 * review points at a location and an author. Done in a handful of batched
 * queries rather than per row, and every step tolerates a missing row — the
 * whole reason the log keeps ids is that the thing it describes can be deleted
 * afterwards, and an entry about something deleted is still a record of what
 * happened.
 */
async function resolveSubjects(
  client: SupabaseClient,
  rows: { id: string; targetType: string; targetId: string | null }[]
): Promise<Map<string, string>> {
  const idsOf = (type: string) =>
    rows.filter((r) => r.targetType === type && r.targetId).map((r) => r.targetId as string);

  const lookup = async (table: string, ids: string[], columns: string) => {
    if (ids.length === 0) return new Map<string, Record<string, unknown>>();
    const { data } = await client.from(table).select(columns).in("id", ids);
    return new Map(
      ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => [row.id as string, row])
    );
  };

  // One hop: the things that only point at something else.
  const [reviewReports, locationReports, reviewPhotos, locationPhotos] = await Promise.all([
    lookup("review_reports", idsOf("review_report"), "id, review_id"),
    lookup("location_reports", idsOf("location_report"), "id, location_id"),
    lookup("review_photos", idsOf("review_photo"), "id, review_id"),
    lookup("location_photos", idsOf("location_photo"), "id, location_id"),
  ]);

  const reviewIds = new Set<string>(idsOf("review"));
  const locationIds = new Set<string>(idsOf("location"));
  for (const row of reviewReports.values()) reviewIds.add(row.review_id as string);
  for (const row of reviewPhotos.values()) reviewIds.add(row.review_id as string);
  for (const row of locationReports.values()) locationIds.add(row.location_id as string);
  for (const row of locationPhotos.values()) locationIds.add(row.location_id as string);

  const reviews = await lookup("reviews", [...reviewIds], "id, location_id, user_id");
  for (const row of reviews.values()) locationIds.add(row.location_id as string);

  const [locations, people] = await Promise.all([
    lookup("locations", [...locationIds], "id, name"),
    lookup("profiles", [...new Set([...idsOf("user"), ...[...reviews.values()].map((r) => r.user_id as string)])].filter(Boolean), "id, username"),
  ]);

  const placeName = (id?: string) => (id ? (locations.get(id)?.name as string) ?? null : null);
  const personName2 = (id?: string) => (id ? (people.get(id)?.username as string) ?? null : null);

  const describeReview = (reviewId?: string) => {
    const review = reviewId ? reviews.get(reviewId) : undefined;
    if (!review) return null;
    const author = personName2(review.user_id as string);
    const place = placeName(review.location_id as string);
    return `a review${author ? ` by ${author}` : ""}${place ? ` on ${place}` : ""}`;
  };

  const out = new Map<string, string>();
  for (const row of rows) {
    if (!row.targetId) continue;
    let subject: string | null = null;
    switch (row.targetType) {
      case "review":
        subject = describeReview(row.targetId);
        break;
      case "review_report":
        subject = describeReview(reviewReports.get(row.targetId)?.review_id as string);
        if (subject) subject = `a report about ${subject}`;
        break;
      case "review_photo": {
        const described = describeReview(reviewPhotos.get(row.targetId)?.review_id as string);
        subject = described ? `a photo on ${described}` : null;
        break;
      }
      case "location":
        subject = placeName(row.targetId);
        break;
      case "location_report": {
        const place = placeName(locationReports.get(row.targetId)?.location_id as string);
        subject = place ? `a report about ${place}` : null;
        break;
      }
      case "location_photo": {
        const place = placeName(locationPhotos.get(row.targetId)?.location_id as string);
        subject = place ? `a photo on ${place}` : null;
        break;
      }
      case "user":
        subject = personName2(row.targetId);
        break;
    }
    if (subject) out.set(row.id, subject);
  }
  return out;
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
