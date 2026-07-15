import type { SupabaseClient } from "@supabase/supabase-js";

export type LocationReportStatus = "open" | "reviewed" | "actioned" | "dismissed";
export type LocationStatus = "pending" | "active" | "flagged" | "removed";

export type LocationReport = {
  id: string;
  locationId: string;
  locationName: string;
  locationStatus: LocationStatus;
  reason: string;
  details: string | null;
  reporterName: string;
  status: LocationReportStatus;
  createdAt: string;
  resolvedAt: string | null;
};

type LocationReportRow = {
  id: string;
  location_id: string;
  reason: string;
  details: string | null;
  status: LocationReportStatus;
  created_at: string;
  resolved_at: string | null;
  locations: { name: string; status: LocationStatus } | null;
  profiles: { display_name: string | null } | null;
};

const LOCATION_REPORT_SELECT =
  "id, location_id, reason, details, status, created_at, resolved_at, locations(name, status), profiles!location_reports_reporter_id_fkey(display_name)";

function mapLocationReport(row: LocationReportRow): LocationReport {
  return {
    id: row.id,
    locationId: row.location_id,
    locationName: row.locations?.name ?? "Unknown location",
    locationStatus: row.locations?.status ?? "active",
    reason: row.reason,
    details: row.details,
    reporterName: row.profiles?.display_name ?? "Anonymous",
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
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
  resolvedBy: string
): Promise<void> {
  const { error } = await client
    .from("location_reports")
    .update({ status, resolved_by: resolvedBy, resolved_at: new Date().toISOString() })
    .eq("id", reportId);
  if (error) throw error;
}

export async function deleteLocationReport(client: SupabaseClient, reportId: string): Promise<void> {
  const { error } = await client.from("location_reports").delete().eq("id", reportId);
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
};

type ReviewReportRow = {
  id: string;
  review_id: string;
  reason: string;
  details: string | null;
  status: LocationReportStatus;
  created_at: string;
  resolved_at: string | null;
  reviews: {
    rating: number;
    title: string | null;
    body: string | null;
    status: ReviewStatus;
    location_id: string;
    profiles: { display_name: string | null } | null;
    locations: { name: string } | null;
  } | null;
  profiles: { display_name: string | null } | null;
};

const REVIEW_REPORT_SELECT =
  "id, review_id, reason, details, status, created_at, resolved_at, reviews(rating, title, body, status, location_id, profiles(display_name), locations(name)), profiles!review_reports_reporter_id_fkey(display_name)";

function mapReviewReport(row: ReviewReportRow): ReviewReport {
  return {
    id: row.id,
    reviewId: row.review_id,
    reviewAuthorName: row.reviews?.profiles?.display_name ?? "Anonymous",
    reviewRating: row.reviews?.rating ?? 0,
    reviewTitle: row.reviews?.title ?? null,
    reviewBody: row.reviews?.body ?? null,
    reviewStatus: row.reviews?.status ?? "visible",
    locationId: row.reviews?.location_id ?? "",
    locationName: row.reviews?.locations?.name ?? "Unknown location",
    reason: row.reason,
    details: row.details,
    reporterName: row.profiles?.display_name ?? "Anonymous",
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
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
  resolvedBy: string
): Promise<void> {
  const { error } = await client
    .from("review_reports")
    .update({ status, resolved_by: resolvedBy, resolved_at: new Date().toISOString() })
    .eq("id", reportId);
  if (error) throw error;
}

export async function deleteReviewReport(client: SupabaseClient, reportId: string): Promise<void> {
  const { error } = await client.from("review_reports").delete().eq("id", reportId);
  if (error) throw error;
}

export async function updateReviewStatus(
  client: SupabaseClient,
  reviewId: string,
  status: ReviewStatus
): Promise<void> {
  const { error } = await client.from("reviews").update({ status }).eq("id", reviewId);
  if (error) throw error;
}
