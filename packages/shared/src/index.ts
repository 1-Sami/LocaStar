export { createSupabaseClient } from "./supabaseClient";
export type { Session, User } from "@supabase/supabase-js";

export { fetchNearbyLocations, fetchCategories } from "./api/locations";
export type { NearbyLocation, NearbyLocationsParams, Category, LocationKind } from "./api/locations";

export {
  fetchSavedLocationIds,
  setSaved,
  fetchSavedLocations,
  fetchSharedLocations,
} from "./api/saves";
export type { SaveKind, SavedLocation } from "./api/saves";
