import type { SupabaseClient } from "@supabase/supabase-js";

export type ClaimStatus = "pending" | "approved" | "rejected";

export type BusinessClaim = {
  id: string;
  locationId: string;
  locationName: string;
  claimantId: string;
  claimantName: string;
  status: ClaimStatus;
  verificationNotes: string | null;
  createdAt: string;
};

type ClaimRow = {
  id: string;
  location_id: string;
  user_id: string;
  status: ClaimStatus;
  verification_notes: string | null;
  created_at: string;
  locations: { name: string } | null;
  profiles: { display_name: string | null } | null;
};

const CLAIM_SELECT =
  "id, location_id, user_id, status, verification_notes, created_at, locations(name), profiles(display_name)";

function mapClaim(row: ClaimRow): BusinessClaim {
  return {
    id: row.id,
    locationId: row.location_id,
    locationName: row.locations?.name ?? "Unknown location",
    claimantId: row.user_id,
    claimantName: row.profiles?.display_name ?? "Anonymous",
    status: row.status,
    verificationNotes: row.verification_notes,
    createdAt: row.created_at,
  };
}

export async function submitBusinessClaim(
  client: SupabaseClient,
  locationId: string,
  userId: string,
  verificationNotes: string | null
): Promise<void> {
  const { error } = await client
    .from("business_claims")
    .insert({ location_id: locationId, user_id: userId, verification_notes: verificationNotes });
  if (error) throw error;
}

export async function fetchMyClaimForLocation(
  client: SupabaseClient,
  userId: string,
  locationId: string
): Promise<BusinessClaim | null> {
  const { data, error } = await client
    .from("business_claims")
    .select(CLAIM_SELECT)
    .eq("user_id", userId)
    .eq("location_id", locationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapClaim(data as unknown as ClaimRow) : null;
}

export async function fetchOpenBusinessClaims(client: SupabaseClient): Promise<BusinessClaim[]> {
  const { data, error } = await client
    .from("business_claims")
    .select(CLAIM_SELECT)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as ClaimRow[]).map(mapClaim);
}

export async function fetchHandledBusinessClaims(client: SupabaseClient): Promise<BusinessClaim[]> {
  const { data, error } = await client
    .from("business_claims")
    .select(CLAIM_SELECT)
    .neq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as ClaimRow[]).map(mapClaim);
}

export async function resolveBusinessClaim(
  client: SupabaseClient,
  claimId: string,
  status: "approved" | "rejected"
): Promise<void> {
  const { error } = await client.from("business_claims").update({ status }).eq("id", claimId);
  if (error) throw error;
}

export async function deleteBusinessClaim(client: SupabaseClient, claimId: string): Promise<void> {
  const { error } = await client.from("business_claims").delete().eq("id", claimId);
  if (error) throw error;
}

export async function verifyLocationOwner(
  client: SupabaseClient,
  locationId: string,
  claimantId: string
): Promise<void> {
  const { error } = await client
    .from("locations")
    .update({ is_verified: true, claimed_by: claimantId })
    .eq("id", locationId);
  if (error) throw error;
}
