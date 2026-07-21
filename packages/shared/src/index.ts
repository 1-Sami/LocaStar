export { createSupabaseClient } from "./supabaseClient";
export type { Session, User } from "@supabase/supabase-js";

export {
  fetchNearbyLocations,
  fetchCategories,
  fetchLocationById,
  submitLocation,
  addLocationPhoto,
  fetchLocationPhotos,
  reportLocation,
  updateLocation,
  fetchLocationCategoryIds,
  setLocationCategories,
  setLocationCreatorVisible,
  deleteLocation,
  fetchMyAddedLocations,
} from "./api/locations";
export type {
  NearbyLocation,
  NearbyLocationsParams,
  Category,
  LocationKind,
  LocationVisibility,
  DayKey,
  OpeningHours,
  LocationDetail,
  LocationSubmission,
  LocationReportInput,
  LocationUpdate,
  MyAddedLocation,
} from "./api/locations";

export {
  fetchSavedLocationIds,
  setSaved,
  fetchSavedLocations,
  fetchMyShares,
  deleteShare,
  searchShareCandidates,
  shareLocation,
} from "./api/saves";
export type {
  SaveKind,
  SavedLocation,
  LocationShare,
  ShareCandidate,
  ShareLocationInput,
} from "./api/saves";

export { fetchReviews, submitReview, reportReview, setReviewLiked } from "./api/reviews";
export type { Review, ReviewInput, ReviewReportInput } from "./api/reviews";

export { fetchProfileStats, fetchMyReviews, fetchProfile, updateProfile } from "./api/profile";
export type {
  ProfileStats,
  MyReview,
  Profile,
  ProfileUpdate,
  ThemePreference,
  NotificationPreferences,
  UserRole,
} from "./api/profile";

export {
  fetchOpenLocationReports,
  fetchHandledLocationReports,
  resolveLocationReport,
  deleteLocationReport,
  updateLocationStatus,
  fetchOpenReviewReports,
  fetchHandledReviewReports,
  resolveReviewReport,
  deleteReviewReport,
  updateReviewStatus,
} from "./api/moderation";
export type {
  LocationReport,
  LocationReportStatus,
  LocationStatus,
  ReviewReport,
  ReviewStatus,
} from "./api/moderation";

export {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "./api/notifications";
export type { Notification, ShareNotificationPayload } from "./api/notifications";

export {
  fetchLists,
  createList,
  deleteList,
  renameList,
  setListVisibility,
  setListLiked,
  fetchListItems,
  addLocationToList,
  removeLocationFromList,
  fetchListMembershipForLocation,
  shareList,
  fetchListsSharedWithMe,
  fetchListShareRecipients,
  deleteListShare,
} from "./api/lists";
export type { LocationList, ListItemLocation, SharedList, ListShareRecipient } from "./api/lists";

export {
  submitBusinessClaim,
  fetchMyClaimForLocation,
  fetchOpenBusinessClaims,
  fetchHandledBusinessClaims,
  resolveBusinessClaim,
  deleteBusinessClaim,
  verifyLocationOwner,
} from "./api/business-claims";
export type { ClaimStatus, BusinessClaim } from "./api/business-claims";

export { fetchFriendships, sendFriendRequest, acceptFriendRequest, removeFriendship } from "./api/friends";
export type { Friend, FriendStatus, FriendDirection } from "./api/friends";
