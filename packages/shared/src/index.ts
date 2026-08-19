export { CategoryColors } from "./categoryColors";
export { createSupabaseClient } from "./supabaseClient";
export { reportCrash, fetchCrashReports, type CrashReport, type CrashReportRow } from "./api/crashes";
export type { Session, User } from "@supabase/supabase-js";

export {
  ALWAYS_OPEN,
  DAY_KEYS,
  isAlwaysOpen,
  fetchNearbyLocations,
  fetchCategories,
  fetchLocationById,
  submitLocation,
  addLocationPhoto,
  fetchLocationPhotos,
  makeCoverPhoto,
  deleteLocationPhoto,
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
  GalleryPhoto,
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

export {
  fetchReviews,
  submitReview,
  addReviewPhoto,
  fetchReviewPhotos,
  deleteReviewPhoto,
  reportReview,
  deleteReview,
  setReviewStatus,
  setReviewLiked,
} from "./api/reviews";
export type { Review, ReviewInput, ReviewPhoto, ReviewReportInput } from "./api/reviews";

export { fetchBlockedUsers, blockUser, unblockUser } from "./api/blocks";
export type { BlockedUser } from "./api/blocks";

export { registerDeviceToken, forgetDeviceToken } from "./api/devices";

export {
  fetchProfileStats,
  fetchMyReviews,
  fetchProfile,
  fetchMyPrivateProfile,
  updateProfile,
  isModeratorRole,
  DELETED_ACCOUNT_NAME,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "./api/profile";
export type {
  ProfileStats,
  MyReview,
  Profile,
  PrivateProfile,
  ProfileUpdate,
  ThemePreference,
  NotificationPreferences,
  UserRole,
} from "./api/profile";

export {
  fetchOpenLocationReports,
  fetchHandledLocationReports,
  releasePhotoHold,
  setPhotoRemoved,
  resolveLocationReport,
  updateLocationStatus,
  fetchOpenReviewReports,
  fetchHandledReviewReports,
  resolveReviewReport,
  updateReviewStatus,
  fetchOpenReportsCount,
  issueBan,
  fetchBansByStatus,
  reviewBan,
  fetchMyActiveBan,
  searchUsers,
  setUserRole,
  fetchModerationActions,
  issueWarning,
  fetchWarningsForUser,
  acknowledgeWarning,
} from "./api/moderation";
export type {
  LocationReport,
  LocationReportStatus,
  LocationStatus,
  ResolutionAction,
  ReviewReport,
  ReviewStatus,
  BanStatus,
  UserBan,
  ManagedUser,
  ModerationAction,
  UserWarning,
} from "./api/moderation";

export {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications,
} from "./api/notifications";
export type {
  Notification,
  ShareNotificationPayload,
  RoleGrantedNotificationPayload,
  ActivityReminderNotificationPayload,
} from "./api/notifications";

export {
  fetchLists,
  createList,
  deleteList,
  renameList,
  setListVisibility,
  setListLiked,
  fetchListItems,
  fetchListMeta,
  addLocationToList,
  removeLocationFromList,
  fetchListMembershipForLocation,
  shareList,
  fetchMyListShares,
  fetchListShareRecipients,
  deleteListShare,
  stopSharingList,
  fetchPublicLists,
  setListSaved,
  fetchListSavedState,
  fetchSavedLists,
} from "./api/lists";
export type {
  LocationList,
  ListItemLocation,
  ListMeta,
  SharedList,
  ListShareRecipient,
  PublicList,
  PublicListSort,
} from "./api/lists";

export {
  submitBusinessClaim,
  fetchMyClaimForLocation,
  fetchOpenBusinessClaims,
  fetchHandledBusinessClaims,
  resolveBusinessClaim,
  verifyLocationOwner,
} from "./api/business-claims";
export type { ClaimStatus, BusinessClaim } from "./api/business-claims";

export {
  fetchFriendships,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriendship,
  fetchPendingFriendRequestCount,
} from "./api/friends";
export type { Friend, FriendStatus, FriendDirection } from "./api/friends";
