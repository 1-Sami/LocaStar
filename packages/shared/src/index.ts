export { createSupabaseClient } from "./supabaseClient";
export type { Session, User } from "@supabase/supabase-js";

export { fetchNearbyLocations, fetchCategories, fetchLocationById } from "./api/locations";
export type { NearbyLocation, NearbyLocationsParams, Category, LocationKind, LocationDetail } from "./api/locations";

export {
  fetchSavedLocationIds,
  setSaved,
  fetchSavedLocations,
  fetchSharedLocations,
} from "./api/saves";
export type { SaveKind, SavedLocation } from "./api/saves";

export { fetchReviews, submitReview } from "./api/reviews";
export type { Review, ReviewInput } from "./api/reviews";
