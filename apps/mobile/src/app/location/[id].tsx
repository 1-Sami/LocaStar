import {
  deleteLocation,
  setPhotoRemoved,
  deleteReview,
  fetchLocationById,
  isAlwaysOpen,
  fetchLocationPhotos,
  fetchMyClaimForLocation,
  makeCoverPhoto,
  fetchProfile,
  fetchReviews,
  reportLocation,
  reportReview,
  setLocationCreatorVisible,
  setReviewLiked,
  setReviewStatus,
  shareLocation,
  submitBusinessClaim,
  type BusinessClaim,
  type DayKey,
  type GalleryPhoto,
  type LocationDetail,
  type OpeningHours,
  type Review,
} from '@locastar/shared';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Dimensions, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBlockAndReport } from '@/lib/block-and-report';
import { useBlockedUsers } from '@/lib/blocked-users-context';
import { AddToListModal } from '@/components/add-to-list-modal';
import { ClaimBusinessModal } from '@/components/claim-business-modal';
import { LocationPhoto } from '@/components/location-photo';
import { ReportModal } from '@/components/report-modal';
import { ShareModal } from '@/components/share-modal';
import { STAR_COLOR, StarRating } from '@/components/star-rating';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSaves } from '@/hooks/use-saves';
import { useTheme } from '@/hooks/use-theme';
import { useUserLocation } from '@/hooks/use-user-location';
import { activityWhen, activityWhenLabel, formatActivityRange } from '@/lib/activity-dates';
import { useAuth } from '@/lib/auth-context';
import { categoryLabelFromName } from '@/lib/categories';
import { confirmAsync } from '@/lib/confirm';
import { useSharedProfile } from '@/lib/profile-context';
import { openDirections } from '@/lib/directions';
import { formatDistance, metresBetween } from '@/lib/distance';
import { buildLocationShareLink } from '@/lib/public-link';
import { supabase } from '@/lib/supabase';

const TEAL = '#2BA3A3';
const TEAL_TINT = 'rgba(43,163,163,0.15)';
const DIRECTIONS_TEXT = '#0B3D2E';

// Monday-first for display. The names come from days.<key> rather than living
// here, so the hours editor on the add/edit forms uses the same seven.
const HOURS_DAYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// Sunday-first to match Date#getDay()'s 0-6 range.
const DAY_ORDER: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function getTodayKey(): DayKey {
  return DAY_ORDER[new Date().getDay()];
}

/*
 * Takes `t` rather than returning keys for the caller to resolve.
 *
 * The alternative — handing back a key plus interpolation params — spreads one
 * decision across two files and still needs the caller to know that the
 * "opens on a later day" case has a day name to translate as well as a time.
 */
function computeHoursStatus(
  hours: OpeningHours,
  t: TFunction
): { isOpen: boolean; primaryLabel: string; secondaryLabel: string } {
  // Seven full days is always-open, and the generic path would describe it as
  // "Open now · Closes 24:00" — technically derived from the data, and useless.
  if (isAlwaysOpen(hours)) {
    return { isOpen: true, primaryLabel: t('location.open24'), secondaryLabel: t('location.everyDay') };
  }

  const now = new Date();
  const todayIndex = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayEntry = hours[DAY_ORDER[todayIndex]];

  if (todayEntry) {
    const [oh, om] = todayEntry.open.split(':').map(Number);
    const [ch, cm] = todayEntry.close.split(':').map(Number);
    if (nowMinutes >= oh * 60 + om && nowMinutes < ch * 60 + cm) {
      return {
        isOpen: true,
        primaryLabel: t('location.openNow'),
        secondaryLabel: t('location.closesAt', { time: todayEntry.close }),
      };
    }
  }

  for (let i = 0; i < 7; i++) {
    const idx = (todayIndex + i) % 7;
    const key = DAY_ORDER[idx];
    const entry = hours[key];
    if (!entry) continue;
    const [oh, om] = entry.open.split(':').map(Number);
    if (i === 0 && nowMinutes < oh * 60 + om) {
      return {
        isOpen: false,
        primaryLabel: t('location.closed'),
        secondaryLabel: t('location.opensAt', { time: entry.open }),
      };
    }
    if (i > 0) {
      return {
        isOpen: false,
        primaryLabel: t('location.closed'),
        secondaryLabel: t('location.opensDayAt', { day: t(`days.${key}`), time: entry.open }),
      };
    }
  }
  return {
    isOpen: false,
    primaryLabel: t('location.closed'),
    secondaryLabel: t('location.hoursUnavailable'),
  };
}

/**
 * A stored website as something openable, or null if there is nothing usable.
 *
 * People type "eskilstuna.se" as often as they paste a full URL, and a bare
 * host has no scheme for the OS to route, so the tap does nothing at all.
 */
function websiteHref(raw: string | null): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** The same address without the scheme or a trailing slash — a URL bar is not a label. */
function websiteText(href: string): string {
  return href.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

function openUrl(url: string): void {
  // Nothing to tell the user if this fails: they tapped a link, and a device
  // with no browser or dialler for it is not something the screen can fix.
  Linking.openURL(url).catch(() => {});
}

/**
 * How long a creator has to correct what they typed. Mirrors the interval in
 * migration 0079 — the database is the thing that actually enforces it, and if
 * these two ever disagree the button lies rather than the rule bending.
 */
const CREATOR_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

function formatWindowLeft(ms: number, t: TFunction): string {
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return t('location.durationHours', { count: hours });
  const minutes = Math.max(1, Math.round(ms / 60_000));
  return t('location.durationMinutes', { count: minutes });
}

const AVATAR_COLORS = ['#4C8FE8', '#4CD37A', '#E8A93B', '#C34CE8', '#F5738A', '#2BA3A3', '#E2791F'];
function avatarColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// Long descriptions push the reviews far below the fold. Six lines is about a
// short paragraph -- enough to judge whether a place is worth reading on about.
const DESCRIPTION_LINES = 6;

const REVIEW_SORT_OPTIONS = [
  { key: 'newest', labelKey: 'location.sortNewest' },
  { key: 'highest', labelKey: 'location.sortHighest' },
  { key: 'lowest', labelKey: 'location.sortLowest' },
] as const;
type ReviewSort = (typeof REVIEW_SORT_OPTIONS)[number]['key'];

export default function LocationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const { favoriteIds, bucketListIds, toggleFavorite, toggleBucketList } = useSaves();
  const { isModerator } = useSharedProfile();
  const { coords: userCoords, usingFallback } = useUserLocation();

  const [location, setLocation] = useState<LocationDetail | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [allPhotos, setAllPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const [locationReportVisible, setLocationReportVisible] = useState(false);
  const [reportingReviewId, setReportingReviewId] = useState<string | null>(null);
  const [shareVisible, setShareVisible] = useState(false);
  const [addToListVisible, setAddToListVisible] = useState(false);
  const [claimVisible, setClaimVisible] = useState(false);
  const [myClaim, setMyClaim] = useState<BusinessClaim | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const { isBlocked } = useBlockedUsers();
  const blockAndReport = useBlockAndReport();
  // Read here rather than through a SafeAreaView, because the viewer's close
  // button is positioned against the picture and only needs the inset as a
  // floor — see the clamp where it is placed.
  const insets = useSafeAreaInsets();
  /*
   * Photos with a blocked uploader are filtered out here, at the single place
   * everything else reads, rather than at each render site. The hero carousel,
   * the gallery grid and the full-screen viewer all index into the same array
   * — filtering later would have left the viewer paging to an index the grid
   * no longer had.
   */
  const [heroWidth, setHeroWidth] = useState(() => Math.min(Dimensions.get('window').width, MaxContentWidth));
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  // Up here with the rest of the state on purpose: this screen returns early
  // while loading and when the place is missing, so a hook declared beside the
  // logic that uses it further down would be called conditionally.
  const [reportingPhoto, setReportingPhoto] = useState<GalleryPhoto | null>(null);
  const photos = allPhotos.filter((photo) => !isBlocked(photo.uploaderId));
  const [viewerWidth, setViewerWidth] = useState(() => Dimensions.get('window').width);
  const [viewerHeight, setViewerHeight] = useState(() => Dimensions.get('window').height);
  const [photoSizes, setPhotoSizes] = useState<Record<string, { width: number; height: number }>>({});
  const heroScrollRef = useRef<ScrollView>(null);
  const viewerScrollRef = useRef<ScrollView>(null);
  // Holds the tapped index between closing the gallery grid and the full
  // viewer actually opening — see openViewerFromGallery further down, which
  // reads and clears it. Declared up here for the same early-return reason
  // as the refs above it.
  const galleryViewerIndexRef = useRef<number | null>(null);
  /*
   * Positions the viewer's ScrollView at viewerIndex — but only when the
   * viewer opens or the device rotates, never when viewerIndex changes on
   * its own. It also changes on every onScroll frame while someone is
   * mid-swipe, and this used to be a JSX contentOffset prop derived straight
   * from that live value: RN re-applies contentOffset whenever the number
   * changes, so every drag was fighting a scroll-to back toward wherever the
   * rounded index had just landed — reported on iOS as the swipe getting
   * stuck between two photos.
   *
   * viewerIndex is read here, not depended on, so a swipe-driven change at
   * an unchanged width does not retrigger this. Only the open transition
   * (viewerIndex !== null flips) and a genuine width change (rotation) do —
   * and rotation should reposition to whatever photo is *currently* on
   * screen, which reading the latest viewerIndex gives for free.
   *
   * Declared here rather than beside openViewerAt, for the same reason
   * reportingPhoto's state sits up here: this screen returns early while
   * loading and when the place is missing, so a hook declared beside the
   * logic that uses it further down would be called conditionally.
   */
  useEffect(() => {
    if (viewerIndex === null || viewerWidth <= 0) return;
    viewerScrollRef.current?.scrollTo({ x: viewerIndex * viewerWidth, y: 0, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerWidth, viewerIndex !== null]);


  const [menuVisible, setMenuVisible] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [descriptionTruncated, setDescriptionTruncated] = useState(false);
  const [reviewSort, setReviewSort] = useState<ReviewSort>('newest');
  const [sortMenuVisible, setSortMenuVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let cancelled = false;
      setLoading(true);
      setLoadFailed(false);
      setActivePhotoIndex(0);
      Promise.all([
        fetchLocationById(supabase, id),
        fetchReviews(supabase, id, session?.user.id),
        fetchLocationPhotos(supabase, id, isModerator),
      ])
        .then(([locationResult, reviewsResult, photosResult]) => {
          if (cancelled) return;
          setLocation(locationResult);
          setReviews(reviewsResult);
          setAllPhotos(photosResult);
        })
        .catch((err) => {
          // fetchLocationById returns null when the row genuinely is not there
          // or is not readable; a rejection means the request failed. Both used
          // to render "This location couldn't be found", so anyone opening a
          // shared link on a bad connection was told the place was gone.
          console.error('Failed to load the location', err);
          if (!cancelled) {
            setLocation(null);
            setReviews([]);
            setAllPhotos([]);
            setLoadFailed(true);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [id, session?.user.id, isModerator])
  );

  useFocusEffect(
    useCallback(() => {
      if (!id || !session) {
        setMyClaim(null);
        return;
      }
      let cancelled = false;
      fetchMyClaimForLocation(supabase, session.user.id, id)
        .then((claim) => {
          if (!cancelled) setMyClaim(claim);
        })
        .catch(() => {
          if (!cancelled) setMyClaim(null);
        });
      return () => {
        cancelled = true;
      };
    }, [id, session])
  );

  useFocusEffect(
    useCallback(() => {
      if (!session) {
        setIsAdmin(false);
        return;
      }
      let cancelled = false;
      fetchProfile(supabase, session.user.id)
        .then((profile) => {
          if (!cancelled) setIsAdmin(profile.role === 'admin');
        })
        .catch(() => {
          if (!cancelled) setIsAdmin(false);
        });
      return () => {
        cancelled = true;
      };
    }, [session])
  );

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <ActivityIndicator style={styles.loadingIndicator} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!location) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <Pressable style={styles.standaloneBackButton} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <ThemedText type="default" themeColor="textSecondary" style={styles.centerText}>
            {loadFailed ? t('common.somethingWentWrong') : t('location.notFound')}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // Reordering is limited to moderators and the verified owner. RLS enforces
  // the same rule (0072), so this only decides whether the control is shown.
  const canReorderPhotos =
    isModerator || Boolean(session && location.claimed_by === session.user.id && location.is_verified);

  // Suppressed when useUserLocation is on its Stockholm fallback: that is a
  // stand-in so search has somewhere to look from, and quoting a distance
  // measured from it would be a confident, wrong number rather than none.
  const distanceLabel =
    location && userCoords && !usingFallback
      ? formatDistance(metresBetween(userCoords, { lat: location.lat, lng: location.lng }))
      : null;

  // Who may edit, matching what the database will actually allow. This used to
  // check isAdmin while the trigger checks is_moderator(), so a moderator who
  // wasn't an admin could edit through the API but saw no button.
  const creatorWindowLeftMs =
    session && location.created_by === session.user.id
      ? CREATOR_EDIT_WINDOW_MS - (Date.now() - new Date(location.created_at).getTime())
      : 0;
  const withinCreatorWindow = creatorWindowLeftMs > 0;
  const canEditLocation =
    isModerator ||
    Boolean(session && location.is_verified && location.claimed_by === session.user.id) ||
    withinCreatorWindow;

  // A private activity is the creator's own event, not part of the public map,
  // so they can remove it (0081). Public content stays admin-only: it carries
  // other people's reviews and photos.
  const ownsPrivateActivity = Boolean(
    session && location.created_by === session.user.id && location.visibility === 'private'
  );

  /*
   * An activity that has ended is the creator's to clear.
   *
   * It is nobody else's any more: a past activity is out of search and out of
   * everyone else's reach, so the reason public content is admin-only — that it
   * carries other people's reviews and photos — has expired along with it.
   */
  const ownsPastActivity = Boolean(
    session && location.created_by === session.user.id && location.status === 'past'
  );
  const canDeleteLocation = isAdmin || ownsPrivateActivity || ownsPastActivity;

  const websiteUrl = websiteHref(location.website);
  const websiteLabel = websiteUrl ? websiteText(websiteUrl) : null;

  const isActivity = location.kind === 'activity';
  const dateRange = isActivity
    ? formatActivityRange(location.starts_at, location.expires_at, i18n.language, t)
    : null;
  const whenNow = isActivity ? activityWhen(location.starts_at, location.expires_at) : null;

  const viewerPhoto = viewerIndex !== null ? photos[viewerIndex] : null;

  /*
   * Where the picture actually is on screen, so the close button can sit on
   * its top-right corner and the counter on its bottom-right.
   *
   * contentFit="contain" letterboxes: the Image element fills the page, but
   * the picture inside it only fills one axis and is centred on the other, so
   * "the corner of the photo" is nowhere near the corner of the element. The
   * same arithmetic contain does — scale to whichever axis runs out first,
   * then halve what is left over — gives the inset on each side.
   *
   * Falls back to the full frame until onLoad reports the picture's shape,
   * which puts the controls at the screen corners for one frame rather than
   * leaving them somewhere arbitrary.
   */
  const viewerSize = viewerPhoto ? photoSizes[viewerPhoto.url] : null;
  const photoInset = (() => {
    if (!viewerSize || viewerWidth <= 0 || viewerHeight <= 0) return { x: 0, y: 0 };
    const scale = Math.min(viewerWidth / viewerSize.width, viewerHeight / viewerSize.height);
    return {
      x: Math.max(0, (viewerWidth - viewerSize.width * scale) / 2),
      y: Math.max(0, (viewerHeight - viewerSize.height * scale) / 2),
    };
  })();
  // Review photos belong to their review, not the place, so they can't lead it.
  const canPromoteCurrentPhoto = canReorderPhotos && Boolean(viewerPhoto?.photoId) && viewerIndex !== 0;

  // Only location photos can be removed from here. A review's photo belongs to
  // its review, so taking it down means acting on the review itself — deleting
  // the image alone would leave the words it illustrated sitting there.
  const canDeleteCurrentPhoto =
    isModerator && Boolean(viewerPhoto?.photoId || viewerPhoto?.reviewPhotoId);

  /** Whichever kind of photo the viewer is on, shaped for the RPC. */
  const currentPhotoRef = {
    locationPhotoId: viewerPhoto?.photoId ?? null,
    reviewPhotoId: viewerPhoto?.reviewPhotoId ?? null,
  };

  /*
   * Anyone signed in can report a photo, except their own.
   *
   * Reporting your own picture does nothing you cannot already do by deleting
   * it, and it would put noise in a queue a person has to read. Signed out is
   * excluded because a report with nobody attached cannot be followed up or
   * counted against anyone abusing the button.
   */
  const canReportCurrentPhoto = Boolean(
    session && viewerPhoto && viewerPhoto.uploaderId !== session.user.id
  );

  const handleDeletePhoto = async () => {
    if (!viewerPhoto || !id) return;
    const confirmed = await confirmAsync(
      t('location.deletePhotoTitle'),
      t('location.deletePhotoBody'),
      t('common.delete')
    );
    if (!confirmed) return;
    try {
      await setPhotoRemoved(supabase, currentPhotoRef, true);
      const refreshed = await fetchLocationPhotos(supabase, id, isModerator);
      setAllPhotos(refreshed);
      // Close the viewer if that was the last photo, otherwise stay put and
      // let the next one slide into this index.
      setViewerIndex(refreshed.length === 0 ? null : Math.min(viewerIndex ?? 0, refreshed.length - 1));
      setActivePhotoIndex(0);
    } catch {
      // Silent for the same reason as handleMakeCover: RLS refusing is the
      // expected outcome for anyone who shouldn't be here.
    }
  };

  /*
   * Takes a photo back out of the trash.
   *
   * Deleting from here used to destroy the row and the stored file outright,
   * while deleting the same photo from the moderation queue gave thirty days to
   * change your mind — and this is the easier path to reach. Now both go to the
   * same place, and this is where it comes back from, because it is where it
   * went.
   */
  const handleRestorePhoto = async () => {
    if (!viewerPhoto || !id) return;
    try {
      await setPhotoRemoved(supabase, currentPhotoRef, false);
      setAllPhotos(await fetchLocationPhotos(supabase, id, isModerator));
    } catch {
      // Same reasoning as the others here: RLS refusing is the expected
      // outcome for anyone who should not be doing this.
    }
  };
  const handleMakeCover = async () => {
    if (!viewerPhoto?.photoId || !id) return;
    const confirmed = await confirmAsync(
      t('location.makeCoverTitle'),
      t('location.makeCoverBody'),
      t('location.makeCoverAction')
    );
    if (!confirmed) return;
    try {
      await makeCoverPhoto(supabase, id, viewerPhoto.photoId);
      const refreshed = await fetchLocationPhotos(supabase, id, isModerator);
      setAllPhotos(refreshed);
      setViewerIndex(0);
      setActivePhotoIndex(0);
    } catch {
      // Left silent on purpose: RLS refusing is the expected outcome for
      // anyone who shouldn't be here, and the control is already hidden.
    }
  };

  const isFavorite = favoriteIds.has(location.id);
  const isBucketListed = bucketListIds.has(location.id);
  // No stand-in image: a place with no photo says so rather than borrowing one.
  const heroImages = photos.map((photo) => photo.url);
  const ratingCounts = [5, 4, 3, 2, 1].map((star) => reviews.filter((r) => r.rating === star).length);
  const maxCount = Math.max(1, ...ratingCounts);
  const myReview = session ? reviews.find((r) => r.user_id === session.user.id) : undefined;
  const canClaim = !location.is_verified && myClaim?.status !== 'pending';
  const canShare = location.visibility !== 'private' || session?.user.id === location.created_by;
  const canCopyLink = location.visibility !== 'private';
  const hasHours = !location.hours_not_applicable && location.hours && Object.keys(location.hours).length > 0;
  const hoursStatus = hasHours ? computeHoursStatus(location.hours!, t) : null;
  const todayKey = getTodayKey();

  /*
   * Blocked authors drop out here, before the sort, so a block empties their
   * review off the screen on the tap rather than on the next load. The place's
   * rating is deliberately left alone: it is an aggregate of what everyone
   * thought, and quietly re-scoring a location per viewer would make the same
   * page show different star counts to different people.
   */
  const visibleReviews = reviews.filter((review) => !isBlocked(review.user_id));

  const sortedReviews = [...visibleReviews].sort((a, b) => {
    if (reviewSort === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (reviewSort === 'highest') return b.rating - a.rating;
    return a.rating - b.rating;
  });

  /*
   * A photo hangs off either a review or the listing itself, and the report
   * has to name whichever it is — a review photo reported as a location photo
   * lands the moderator on the wrong thing.
   */
  const handleBlockPhotoUploader = async (photo: GalleryPhoto) => {
    if (!session || !photo.uploaderId) return;
    const closed = await blockAndReport(
      photo.uploaderId,
      photo.uploaderName,
      photo.reviewId && photo.reviewPhotoId
        ? { kind: 'reviewPhoto', reviewId: photo.reviewId, reviewPhotoId: photo.reviewPhotoId }
        : { kind: 'location', locationId: location.id }
    );
    // The photo has just been filtered out from under the viewer, so leave it.
    if (closed) setViewerIndex(null);
  };

  const handleBlockReviewAuthor = async (review: Review) => {
    if (!session) {
      router.push('/sign-in');
      return;
    }
    if (!review.user_id) return;
    await blockAndReport(review.user_id, review.author_name, {
      kind: 'review',
      reviewId: review.id,
    });
  };

  const handleOpenLocationReport = () => {
    setMenuVisible(false);
    if (!session) {
      router.push('/sign-in');
      return;
    }
    setLocationReportVisible(true);
  };

  const handleOpenReviewReport = (reviewId: string) => {
    if (!session) {
      router.push('/sign-in');
      return;
    }
    setReportingReviewId(reviewId);
  };

  const handleDeleteOwnReview = async (reviewId: string) => {
    const confirmed = await confirmAsync(
      t('location.deleteReviewTitle'),
      t('location.deleteReviewBody'),
      t('common.delete')
    );
    if (!confirmed) return;

    const previous = reviews;
    setReviews((current) => current.filter((r) => r.id !== reviewId));
    try {
      await deleteReview(supabase, reviewId);
      // The average and count live on the location row and are recalculated by
      // trigger, so re-read rather than trying to patch them here.
      const fresh = await fetchLocationById(supabase, id);
      if (fresh) setLocation(fresh);
    } catch {
      setReviews(previous);
    }
  };

  /**
   * Takes a review down as a moderator.
   *
   * 'removed' rather than a delete: it is reversible, and a trigger records it
   * in the moderation log. Deleting a harmful comment outright would also
   * destroy the evidence that it was ever posted. Only the author gets to
   * erase their own words.
   */
  const handleRemoveReview = async (reviewId: string) => {
    const confirmed = await confirmAsync(
      t('location.removeReviewTitle'),
      t('location.removeReviewBody'),
      t('location.removeAction')
    );
    if (!confirmed) return;

    const previous = reviews;
    setReviews((current) => current.filter((r) => r.id !== reviewId));
    try {
      await setReviewStatus(supabase, reviewId, 'removed');
      const fresh = await fetchLocationById(supabase, id);
      if (fresh) setLocation(fresh);
    } catch {
      setReviews(previous);
    }
  };

  const handleToggleLike = async (review: Review) => {
    if (!session) {
      router.push('/sign-in');
      return;
    }
    const nextLiked = !review.likedByMe;
    setReviews((current) =>
      current.map((r) =>
        r.id === review.id ? { ...r, likedByMe: nextLiked, likeCount: r.likeCount + (nextLiked ? 1 : -1) } : r
      )
    );
    try {
      await setReviewLiked(supabase, review.id, session.user.id, nextLiked);
    } catch {
      setReviews((current) =>
        current.map((r) =>
          r.id === review.id ? { ...r, likedByMe: review.likedByMe, likeCount: review.likeCount } : r
        )
      );
    }
  };

  const handleOpenShare = () => {
    setMenuVisible(false);
    if (!session) {
      router.push('/sign-in');
      return;
    }
    setShareVisible(true);
  };

  const handleCopyLink = async () => {
    const link = buildLocationShareLink(location.id);
    await Clipboard.setStringAsync(link);
    setLinkCopied(true);
    setTimeout(() => {
      setLinkCopied(false);
      setMenuVisible(false);
    }, 900);
  };

  const handleOpenAddToList = () => {
    setMenuVisible(false);
    if (!session) {
      router.push('/sign-in');
      return;
    }
    setAddToListVisible(true);
  };

  const handleDeleteLocation = async () => {
    const confirmed = await confirmAsync(
      location.kind === 'activity'
        ? t('location.deleteActivityTitle')
        : t('location.deletePlaceTitle'),
      t('location.deleteLocationBody', { name: location.name }),
      t('common.delete')
    );
    if (!confirmed) return;
    await deleteLocation(supabase, location.id);
    router.back();
  };

  const handleRemoveCreatorCredit = async () => {
    const confirmed = await confirmAsync(
      t('location.removeCreatorTitle'),
      t('location.removeCreatorBody'),
      t('location.removeAction')
    );
    if (!confirmed) return;
    await setLocationCreatorVisible(supabase, location.id, false);
    setLocation((current) => (current ? { ...current, creator_visible: false, creator_username: null } : current));
  };

  const handleOpenClaim = () => {
    setMenuVisible(false);
    if (!session) {
      router.push('/sign-in');
      return;
    }
    setClaimVisible(true);
  };

  // Full-screen viewer: opens on the tapped photo and can swipe through them all.
  const openViewerAt = (index: number) => {
    if (photos.length === 0) return;
    setViewerIndex(Math.max(0, Math.min(index, photos.length - 1)));
  };

  /*
   * Going from the gallery grid to the full viewer means closing one Modal
   * and opening another. Doing both in the same tick (setGalleryVisible(false)
   * immediately followed by openViewerAt) sometimes has the viewer's native
   * modal start presenting before the gallery's has actually finished
   * dismissing on iOS — the two are briefly stacked, and the viewer's
   * SafeAreaView reads a stale top inset of 0 for that first frame, landing
   * the close button and photo count under the status bar. onDismiss (iOS
   * only) fires once the gallery modal is truly gone, so routing through it
   * closes that race. Android's Modal doesn't expose onDismiss, but it also
   * hasn't shown this bug, so it keeps the direct open.
   */
  const openViewerFromGallery = (index: number) => {
    if (Platform.OS === 'ios') {
      galleryViewerIndexRef.current = index;
      setGalleryVisible(false);
    } else {
      setGalleryVisible(false);
      openViewerAt(index);
    }
  };
  const handleGalleryDismiss = () => {
    if (galleryViewerIndexRef.current !== null) {
      openViewerAt(galleryViewerIndexRef.current);
      galleryViewerIndexRef.current = null;
    }
  };

  const handleWriteReview = () => {
    if (!session) {
      router.push('/sign-in');
      return;
    }
    router.push({
      pathname: '/write-review',
      params: {
        locationId: location.id,
        locationName: location.name,
        locationKind: location.kind,
        ...(myReview
          ? {
              reviewId: myReview.id,
              rating: String(myReview.rating),
              title: myReview.title ?? '',
              body: myReview.body ?? '',
            }
          : {}),
      },
    });
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.heroWrapper} onLayout={(e) => setHeroWidth(e.nativeEvent.layout.width)}>
            {heroImages.length === 0 ? (
              <LocationPhoto url={null} style={[styles.hero, { width: heroWidth }]} iconSize={44} />
            ) : (
              <ScrollView
                ref={heroScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(e) => {
                  if (heroWidth > 0) {
                    setActivePhotoIndex(Math.round(e.nativeEvent.contentOffset.x / heroWidth));
                  }
                }}
                scrollEventThrottle={32}>
                {heroImages.map((uri, index) => (
                  <Pressable key={index} onPress={() => openViewerAt(index)}>
                    <Image source={{ uri }} style={[styles.hero, { width: heroWidth }]} contentFit="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="arrow-back" size={18} color="#ffffff" />
            </Pressable>
            <Pressable style={styles.overflowButton} onPress={() => setMenuVisible(true)} hitSlop={8}>
              <Ionicons name="ellipsis-horizontal" size={18} color="#ffffff" />
            </Pressable>
            {photos.length > 0 && (
              <Pressable style={styles.photoCountButton} onPress={() => setGalleryVisible(true)}>
                <Ionicons name="images-outline" size={13} color="#ffffff" />
                <ThemedText type="small" style={styles.photoCountText}>
                  {activePhotoIndex + 1}/{photos.length}
                </ThemedText>
              </Pressable>
            )}
            {heroImages.length > 1 && (
              <View style={styles.photoDotsRow} pointerEvents="none">
                {heroImages.map((_, index) => (
                  <View
                    key={index}
                    style={[styles.photoDot, index === activePhotoIndex && styles.photoDotActive]}
                  />
                ))}
              </View>
            )}
          </View>

          <View style={styles.body}>
            <View style={styles.titleRow}>
              <View style={styles.titleRowLeft}>
                {location.category_label && (
                  <View style={styles.categoryPill}>
                    <ThemedText type="small" style={styles.categoryPillText}>
                      {categoryLabelFromName(t, location.category_label)}
                    </ThemedText>
                  </View>
                )}
                {location.other_category_detail && (
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                    style={styles.otherCategoryDetail}
                    numberOfLines={1}>
                    {location.other_category_detail}
                  </ThemedText>
                )}
                {location.visibility === 'private' && (
                  <View style={styles.privateBadge}>
                    <Ionicons name="lock-closed" size={11} color="#1A1400" />
                    <ThemedText type="small" style={styles.privateBadgeText}>
                      {t('common.private')}
                    </ThemedText>
                  </View>
                )}
              </View>
              {canEditLocation && (
                <Pressable onPress={() => router.push({ pathname: '/edit-location', params: { id: location.id } })}>
                  <ThemedText type="linkPrimary" style={styles.editLink}>
                    {t('common.edit')}
                  </ThemedText>
                </Pressable>
              )}
            </View>

            <View style={styles.nameRow}>
              <ThemedText type="default" style={styles.name}>
                {location.name}
              </ThemedText>
              {location.is_verified && <Ionicons name="checkmark-circle" size={18} color="#4CD37A" />}
            </View>

            <View style={styles.ratingRow}>
              <StarRating rating={location.avg_rating} size={16} />
              <ThemedText type="small" themeColor="textSecondary">
                {location.avg_rating.toFixed(1)} · {location.review_count}{' '}
                {t('reviewCount.label', { count: location.review_count })}
              </ThemedText>
            </View>

            {/* Above the address, and out of the grey metadata list entirely.
                For an activity the dates are not one detail among six — they
                are the whole question of whether you can go at all, and they
                were losing a legibility contest with the street name. */}
            {/* Otherwise the screen looks exactly as it did while the activity
                was running, and only the creator can see it at all — so say so
                rather than let them assume it is still out there. */}
            {location.status === 'past' && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.pastNotice}>
                {t('location.activityEndedOnlyYou')}
              </ThemedText>
            )}
            {dateRange && (
              <View style={[styles.dateBanner, { borderColor: theme.accent }]}>
                <Ionicons name="calendar" size={18} color={theme.accent} />
                <View style={styles.dateBannerText}>
                  <ThemedText type="default" style={styles.dateRangeText}>
                    {dateRange}
                  </ThemedText>
                  {whenNow && (
                    <ThemedText type="smallBold" style={{ color: theme.accent }}>
                      {activityWhenLabel(whenNow, location.starts_at, t)}
                    </ThemedText>
                  )}
                </View>
              </View>
            )}

            {location.address && (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color={theme.textSecondary} />
                <ThemedText type="default" themeColor="textSecondary" style={styles.addressText}>
                  {location.address}
                </ThemedText>
              </View>
            )}

            {distanceLabel && (
              <View style={styles.infoRow}>
                <Ionicons name="navigate-outline" size={16} color={theme.textSecondary} />
                <ThemedText type="default" themeColor="textSecondary" style={styles.addressText}>
                  {t('location.distanceAway', { distance: distanceLabel })}
                </ThemedText>
              </View>
            )}

            {/* Both were collected when a place was added and then shown
                nowhere, so a website someone had typed in was simply lost. */}
            {websiteUrl && (
              <Pressable style={styles.infoRow} onPress={() => openUrl(websiteUrl)}>
                <Ionicons name="globe-outline" size={16} color={theme.textSecondary} />
                <ThemedText type="default" style={[styles.addressText, styles.linkUnderline]} numberOfLines={1}>
                  {websiteLabel}
                </ThemedText>
              </Pressable>
            )}

            {location.phone && (
              <Pressable style={styles.infoRow} onPress={() => openUrl(`tel:${location.phone}`)}>
                <Ionicons name="call-outline" size={16} color={theme.textSecondary} />
                <ThemedText type="default" style={[styles.addressText, styles.linkUnderline]}>
                  {location.phone}
                </ThemedText>
              </Pressable>
            )}

            {location.email && (
              <Pressable style={styles.infoRow} onPress={() => openUrl(`mailto:${location.email}`)}>
                <Ionicons name="mail-outline" size={16} color={theme.textSecondary} />
                <ThemedText type="default" style={[styles.addressText, styles.linkUnderline]} numberOfLines={1}>
                  {location.email}
                </ThemedText>
              </Pressable>
            )}

            {location.creator_visible && location.creator_username && (
              <View style={styles.addedByRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  Added by @{location.creator_username}
                </ThemedText>
                {session?.user.id === location.created_by && (
                  <Pressable onPress={handleRemoveCreatorCredit} hitSlop={8}>
                    <ThemedText type="small" style={styles.removeCreditText}>
                      {t('common.delete')}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            )}

            {/* Say the window exists and that it ends, rather than letting the
                Edit link vanish overnight with no explanation. */}
            {withinCreatorWindow && !isModerator && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.statusLine}>
                {t('location.creatorWindow', { time: formatWindowLeft(creatorWindowLeftMs, t) })}
              </ThemedText>
            )}

            {location.is_verified ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.statusLine}>
                ✓ Verified{location.owner_username ? ` · Owned by @${location.owner_username}` : ''}
              </ThemedText>
            ) : (
              myClaim?.status === 'pending' && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.statusLine}>
                  {t('location.claimPending')}
                </ThemedText>
              )
            )}

            <View style={styles.actionButtonsRow}>
              <Pressable
                style={styles.directionsButton}
                onPress={() => openDirections({ lat: location.lat, lng: location.lng }, location.name)}>
                <Ionicons name="navigate-outline" size={18} color={DIRECTIONS_TEXT} />
                <ThemedText type="smallBold" style={styles.directionsButtonText}>
                  {t('components.directions')}
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.squareActionButton, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}
                onPress={() => toggleBucketList(location.id)}
                accessibilityLabel={t('location.wantToGo')}>
                <Ionicons
                  name={isBucketListed ? 'bookmark' : 'bookmark-outline'}
                  size={22}
                  color={isBucketListed ? '#F5C242' : theme.text}
                />
              </Pressable>
              <Pressable
                style={[styles.squareActionButton, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}
                onPress={() => toggleFavorite(location.id)}
                accessibilityLabel={t('location.favorite')}>
                <ThemedText style={isFavorite ? styles.iconActiveFavorite : styles.squareActionIcon}>
                  {isFavorite ? '♥' : '♡'}
                </ThemedText>
              </Pressable>
            </View>

            {location.description && (
              <View style={[styles.infoCard, { borderColor: theme.backgroundSelected }]}>
                <ThemedText
                  type="default"
                  themeColor="textSecondary"
                  style={styles.descriptionText}
                  numberOfLines={descriptionExpanded ? undefined : DESCRIPTION_LINES}
                  // Measured on the clamped render: onTextLayout reports the
                  // lines actually drawn, so a description that fits shows no
                  // "Read more" at all. Guessing from character count would be
                  // wrong the moment someone changes font size.
                  onTextLayout={(event) => {
                    if (!descriptionExpanded && event.nativeEvent.lines.length >= DESCRIPTION_LINES) {
                      setDescriptionTruncated(true);
                    }
                  }}>
                  {location.description}
                </ThemedText>
                {descriptionTruncated && (
                  <Pressable onPress={() => setDescriptionExpanded((open) => !open)} hitSlop={8}>
                    <ThemedText type="smallBold" style={styles.readMoreText}>
                      {descriptionExpanded ? t('location.showLess') : t('location.readMore')}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            )}

            {location.hours_not_applicable ? (
              <View style={[styles.infoCard, styles.hoursNaCard, { borderColor: theme.backgroundSelected }]}>
                <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
                <ThemedText type="default" themeColor="textSecondary">
                  {t('location.hoursNotSpecified')}
                </ThemedText>
              </View>
            ) : (
              hasHours &&
              hoursStatus && (
                <View style={[styles.infoCard, { borderColor: theme.backgroundSelected }]}>
                  <Pressable style={styles.hoursRow} onPress={() => setHoursExpanded((v) => !v)}>
                    <View style={styles.hoursRowLeft}>
                      <Ionicons name="time-outline" size={16} color={theme.text} />
                      <ThemedText type="smallBold">{hoursStatus.primaryLabel}</ThemedText>
                    </View>
                    <View style={styles.hoursRowRight}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {hoursStatus.secondaryLabel}
                      </ThemedText>
                      <Ionicons
                        name={hoursExpanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={theme.textSecondary}
                      />
                    </View>
                  </Pressable>
                  {hoursExpanded && (
                    <View style={styles.hoursExpandedList}>
                      {HOURS_DAYS.map((day) => {
                        const entry = location.hours?.[day];
                        const isToday = day === todayKey;
                        return (
                          <View key={day} style={styles.hoursDisplayRow}>
                            <ThemedText type="small" themeColor={isToday ? undefined : 'textSecondary'}>
                              {t(`days.${day}`)}
                            </ThemedText>
                            <ThemedText type="small" themeColor={entry && isToday ? undefined : 'textSecondary'}>
                              {entry ? `${entry.open} – ${entry.close}` : t('location.closed')}
                            </ThemedText>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              )
            )}

            <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />

            <View style={styles.reviewsHeaderRow}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                {t('location.reviews')}
              </ThemedText>
              <Pressable style={styles.writeReviewButton} onPress={handleWriteReview}>
                <ThemedText type="smallBold" style={styles.writeReviewButtonText}>
                  {myReview ? t('location.editReview') : t('location.writeReview')}
                </ThemedText>
              </Pressable>
            </View>

            {reviews.length > 0 && (
              <>
                <View style={styles.ratingSummaryRow}>
                  <View style={styles.ratingSummaryLeft}>
                    <View style={styles.ratingSummaryTopRow}>
                      <ThemedText style={styles.ratingSummaryNumber}>{location.avg_rating.toFixed(1)}</ThemedText>
                      <StarRating rating={location.avg_rating} size={14} />
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      {reviews.length} {t('reviewCount.label', { count: reviews.length })}
                    </ThemedText>
                  </View>
                  <View style={styles.breakdown}>
                    {[5, 4, 3, 2, 1].map((star, index) => (
                      <View key={star} style={styles.breakdownRow}>
                        <ThemedText type="small" numberOfLines={1} style={styles.breakdownLabel}>
                          {star}★
                        </ThemedText>
                        <View style={[styles.breakdownTrack, { backgroundColor: theme.backgroundElement }]}>
                          <View
                            style={[
                              styles.breakdownFill,
                              { width: `${(ratingCounts[index] / maxCount) * 100}%` },
                            ]}
                          />
                        </View>
                        <ThemedText
                          type="small"
                          themeColor="textSecondary"
                          numberOfLines={1}
                          style={styles.breakdownCount}>
                          {ratingCounts[index]}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                </View>

                <Pressable
                  style={[styles.sortButton, { backgroundColor: theme.backgroundElement }]}
                  onPress={() => setSortMenuVisible(true)}>
                  <Ionicons name="swap-vertical-outline" size={13} color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {t(REVIEW_SORT_OPTIONS.find((o) => o.key === reviewSort)?.labelKey ?? 'location.sortNewest')}
                  </ThemedText>
                </Pressable>
              </>
            )}

            {reviews.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyReviews}>
                {t('location.noReviews')}
              </ThemedText>
            ) : (
              <View style={styles.reviewList}>
                {sortedReviews.map((review) => (
                  <View
                    key={review.id}
                    style={[styles.reviewCard, { borderColor: theme.backgroundSelected }]}>
                    {/* Reporting your own review achieves nothing — it would
                        only put your own words in front of a moderator. Your
                        own gets a delete instead, and a moderator gets the
                        take-down directly rather than having to file a report
                        against content they are already looking at. */}
                    <View style={styles.reviewActions}>
                      {session && review.user_id === session.user.id ? (
                        <Pressable onPress={() => handleDeleteOwnReview(review.id)} hitSlop={8}>
                          <Ionicons name="trash-outline" size={14} color={theme.textSecondary} />
                        </Pressable>
                      ) : (
                        <>
                          {isModerator && (
                            <Pressable onPress={() => handleRemoveReview(review.id)} hitSlop={8}>
                              <Ionicons name="eye-off-outline" size={15} color="#E05252" />
                            </Pressable>
                          )}
                          <Pressable onPress={() => handleOpenReviewReport(review.id)} hitSlop={8}>
                            <Ionicons name="flag-outline" size={14} color={theme.textSecondary} />
                          </Pressable>
                          {/* Beside Report, because this is where someone
                              looks when a review is the problem — and until
                              now the only way to block anyone was to wait for
                              them to send a friend request. An anonymised
                              review has no author left to block. */}
                          {review.user_id && (
                            <Pressable onPress={() => handleBlockReviewAuthor(review)} hitSlop={8}>
                              <Ionicons name="ban-outline" size={14} color={theme.textSecondary} />
                            </Pressable>
                          )}
                        </>
                      )}
                    </View>
                    <View style={styles.reviewHeader}>
                      {review.author_avatar_url ? (
                        <Image source={{ uri: review.author_avatar_url }} style={styles.reviewAvatar} />
                      ) : (
                        <View
                          style={[
                            styles.reviewAvatar,
                            styles.reviewAvatarFallback,
                            {
                              // An anonymised review has no author id, so fall
                              // back to the review's own id — still stable, so
                              // the placeholder colour doesn't change per render.
                              backgroundColor: avatarColorFor(review.user_id ?? review.id),
                            },
                          ]}>
                          <ThemedText type="smallBold" style={styles.reviewAvatarInitial}>
                            {(review.author_name?.[0] ?? '?').toUpperCase()}
                          </ThemedText>
                        </View>
                      )}
                      <View style={styles.reviewAuthorColumn}>
                        <ThemedText type="smallBold">{review.author_name}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {new Date(review.created_at).toLocaleDateString()}
                        </ThemedText>
                      </View>
                    </View>
                    <StarRating rating={review.rating} size={14} />
                    {review.title && (
                      <ThemedText type="smallBold" style={styles.reviewTitle}>
                        {review.title}
                      </ThemedText>
                    )}
                    {review.body && (
                      <ThemedText type="default" style={styles.reviewBody}>
                        {review.body}
                      </ThemedText>
                    )}
                    {review.photos.length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reviewPhotoRow}>
                        {review.photos.map((uri, index) => (
                          <Pressable
                            key={index}
                            onPress={() => {
                              const galleryIndex = photos.findIndex((photo) => photo.url === uri);
                              openViewerAt(galleryIndex >= 0 ? galleryIndex : 0);
                            }}>
                            <Image source={{ uri }} style={styles.reviewPhotoThumb} contentFit="cover" />
                          </Pressable>
                        ))}
                      </ScrollView>
                    )}
                    <Pressable style={styles.likeRow} onPress={() => handleToggleLike(review)} hitSlop={8}>
                      <Ionicons
                        name={review.likedByMe ? 'heart' : 'heart-outline'}
                        size={16}
                        color={review.likedByMe ? '#E05252' : theme.textSecondary}
                      />
                      <ThemedText type="small" themeColor="textSecondary">
                        {review.likeCount}
                      </ThemedText>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {canDeleteLocation && (
              <Pressable style={styles.adminDeleteButton} onPress={handleDeleteLocation}>
                <ThemedText type="smallBold" style={styles.adminDeleteButtonText}>
                  Delete this {location.kind}
                  {isAdmin && !ownsPrivateActivity ? ' (admin)' : ''}
                </ThemedText>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={menuVisible} animationType="slide" transparent onRequestClose={() => setMenuVisible(false)}>
        <Pressable
          style={[styles.modalBackdrop, { paddingBottom: insets.bottom }]}
          onPress={() => setMenuVisible(false)}>
          <ThemedView type="backgroundElement" style={styles.modalContent}>
            <Pressable style={styles.menuRow} onPress={handleOpenAddToList}>
              <MaterialCommunityIcons name="folder-marker-outline" size={20} color={theme.text} />
              <ThemedText type="default">{t('location.addToList')}</ThemedText>
            </Pressable>
            {canShare && (
              <Pressable style={styles.menuRow} onPress={handleOpenShare}>
                <Ionicons name="share-outline" size={18} color={theme.text} />
                <ThemedText type="default">{t('location.share')}</ThemedText>
              </Pressable>
            )}
            {canCopyLink && (
              <Pressable style={styles.menuRow} onPress={handleCopyLink}>
                <Ionicons name={linkCopied ? 'checkmark' : 'link-outline'} size={18} color={theme.text} />
                <ThemedText type="default">
                  {linkCopied ? t('location.linkCopied') : t('location.copyLink')}
                </ThemedText>
              </Pressable>
            )}
            {canClaim && (
              <Pressable style={styles.menuRow} onPress={handleOpenClaim}>
                <Ionicons name="storefront-outline" size={18} color={theme.text} />
                <ThemedText type="default">{t('location.claimBusiness')}</ThemedText>
              </Pressable>
            )}
            <Pressable style={styles.menuRow} onPress={handleOpenLocationReport}>
              <Ionicons name="flag-outline" size={18} color="#E05252" />
              <ThemedText type="default" style={styles.menuReportText}>
                {t('common.report')}
              </ThemedText>
            </Pressable>
          </ThemedView>
        </Pressable>
      </Modal>

      <Modal visible={sortMenuVisible} animationType="slide" transparent onRequestClose={() => setSortMenuVisible(false)}>
        <Pressable
          style={[styles.modalBackdrop, { paddingBottom: insets.bottom }]}
          onPress={() => setSortMenuVisible(false)}>
          <ThemedView type="backgroundElement" style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              {t('location.sortReviews')}
            </ThemedText>
            {REVIEW_SORT_OPTIONS.map((option) => (
              <Pressable
                key={option.key}
                style={styles.sortOptionRow}
                onPress={() => {
                  setReviewSort(option.key);
                  setSortMenuVisible(false);
                }}>
                <ThemedText type="default">{t(option.labelKey)}</ThemedText>
                <ThemedText type="default">{reviewSort === option.key ? '✓' : ''}</ThemedText>
              </Pressable>
            ))}
          </ThemedView>
        </Pressable>
      </Modal>

      <ReportModal
        visible={locationReportVisible}
        title={t('location.reportLocationTitle')}
        confirmationText={t('location.reportLocationConfirm')}
        onClose={() => setLocationReportVisible(false)}
        onSubmit={async (reason, details) => {
          if (!session) return;
          await reportLocation(supabase, {
            locationId: location.id,
            reporterId: session.user.id,
            reason,
            details,
          });
        }}
      />

      <ReportModal
        visible={reportingReviewId !== null}
        title={t('location.reportReviewTitle')}
        confirmationText={t('location.reportReviewConfirm')}
        target="review"
        onClose={() => setReportingReviewId(null)}
        /* The photos the review carries, shown inside the sheet. Reporting a
           review because of its picture meant describing the picture from
           memory once the sheet covered it. */
        onSubmit={async (reason, details) => {
          if (!session || !reportingReviewId) return;
          await reportReview(supabase, {
            reviewId: reportingReviewId,
            reporterId: session.user.id,
            reason,
            details,
          });
        }}
      >
        {(reviews.find((r) => r.id === reportingReviewId)?.photos.length ?? 0) > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reportPhotoStrip}>
            {reviews
              .find((r) => r.id === reportingReviewId)
              ?.photos.map((uri, index) => (
                <Image key={index} source={{ uri }} style={styles.reportPhotoThumb} contentFit="cover" />
              ))}
          </ScrollView>
        )}
      </ReportModal>

      {/* Reporting one photo, from the viewer it is open in.
          A photo belongs either to the place or to a review, so the report goes
          into whichever queue already owns it — carrying the photo's id so the
          moderator sees the picture instead of being told to go and find it. */}
      <ReportModal
        visible={reportingPhoto !== null}
        title={t('location.reportPhotoTitle')}
        confirmationText={t('location.reportPhotoConfirm')}
        onClose={() => setReportingPhoto(null)}
        onSubmit={async (reason, details) => {
          if (!session || !reportingPhoto) return;
          if (reportingPhoto.reviewId && reportingPhoto.reviewPhotoId) {
            await reportReview(supabase, {
              reviewId: reportingPhoto.reviewId,
              reporterId: session.user.id,
              reason,
              details,
              reviewPhotoId: reportingPhoto.reviewPhotoId,
            });
            return;
          }
          await reportLocation(supabase, {
            locationId: location.id,
            reporterId: session.user.id,
            reason,
            details,
            locationPhotoId: reportingPhoto.photoId,
          });
        }}
      />

      <ShareModal
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        onShare={async (recipientId, note) => {
          if (!session) return;
          await shareLocation(supabase, {
            locationId: location.id,
            senderId: session.user.id,
            recipientId,
            note,
          });
        }}
      />

      {session && (
        <AddToListModal
          visible={addToListVisible}
          userId={session.user.id}
          locationId={location.id}
          onClose={() => setAddToListVisible(false)}
        />
      )}

      <ClaimBusinessModal
        visible={claimVisible}
        onClose={() => setClaimVisible(false)}
        onSubmit={async (verificationNotes) => {
          if (!session) return;
          await submitBusinessClaim(supabase, location.id, session.user.id, verificationNotes);
          setMyClaim({
            id: '',
            locationId: location.id,
            locationName: location.name,
            claimantId: session.user.id,
            claimantName: '',
            status: 'pending',
            verificationNotes,
            createdAt: new Date().toISOString(),
          });
        }}
      />

      <Modal
        visible={galleryVisible}
        animationType="slide"
        onRequestClose={() => setGalleryVisible(false)}
        onDismiss={handleGalleryDismiss}>
        <ThemedView style={styles.container}>
          <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            <View style={styles.galleryHeader}>
              <ThemedText type="subtitle">Photos ({photos.length})</ThemedText>
              <Pressable onPress={() => setGalleryVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={26} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.galleryGrid}>
              {photos.map((photo, index) => (
                <Pressable
                  key={index}
                  style={styles.galleryThumbWrapper}
                  onPress={() => openViewerFromGallery(index)}>
                  <Image source={{ uri: photo.url }} style={styles.galleryThumb} contentFit="cover" />
                </Pressable>
              ))}
            </ScrollView>
          </SafeAreaView>
        </ThemedView>
      </Modal>

      <Modal
        visible={viewerIndex !== null}
        animationType="fade"
        onRequestClose={() => setViewerIndex(null)}
        supportedOrientations={['portrait', 'landscape']}>
        <View
          style={styles.viewerRoot}
          onLayout={(e) => {
            setViewerWidth(e.nativeEvent.layout.width);
            setViewerHeight(e.nativeEvent.layout.height);
          }}>
          <ScrollView
            ref={viewerScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              if (viewerWidth > 0) {
                setViewerIndex(Math.round(e.nativeEvent.contentOffset.x / viewerWidth));
              }
            }}
            scrollEventThrottle={32}>
            {photos.map((photo, index) => (
              <View key={index} style={[styles.viewerPage, { width: viewerWidth }]}>
                <Image
                  source={{ uri: photo.url }}
                  style={styles.viewerImage}
                  contentFit="contain"
                  // The picture's own shape, so the controls can sit on its
                  // corners rather than the screen's. Keyed by url because the
                  // gallery reorders when a photo is removed or promoted.
                  onLoad={(e) =>
                    setPhotoSizes((current) =>
                      current[photo.url]
                        ? current
                        : { ...current, [photo.url]: { width: e.source.width, height: e.source.height } }
                    )
                  }
                />
              </View>
            ))}
          </ScrollView>

          {/* Both pinned to the picture's corners rather than the screen's, so
              they read as belonging to the photo. The inset is clamped to the
              safe area at the top: a wide picture on a tall screen would
              otherwise put the close button under the notch. */}
          <Pressable
            style={[
              styles.viewerCloseButton,
              styles.viewerCloseFloating,
              { top: Math.max(photoInset.y + Spacing.two, insets.top + Spacing.two), right: photoInset.x + Spacing.two },
            ]}
            onPress={() => setViewerIndex(null)}
            hitSlop={12}>
            <Ionicons name="close" size={24} color="#ffffff" />
          </Pressable>

          <ThemedText
            type="smallBold"
            style={[
              styles.viewerCount,
              { bottom: photoInset.y + Spacing.two, right: photoInset.x + Spacing.two },
            ]}>
            {(viewerIndex ?? 0) + 1} / {photos.length}
          </ThemedText>

          <SafeAreaView style={styles.viewerFooter} edges={['bottom']} pointerEvents="box-none">
            {/* Who took it and a way to complain about it, on the photo itself.
                Reporting used to mean leaving the viewer, scrolling the reviews
                to find the one this picture hangs off, and reporting that —
                which on a place with a hundred reviews is a search. */}
            {/* Credit sits on its own line, aligned right, so it reads as a
                caption on the photo rather than as a label for the buttons. */}
            {viewerPhoto?.uploaderName && (
              <ThemedText type="small" style={styles.viewerCredit}>
                {t('location.photoAddedBy', { name: viewerPhoto.uploaderName })}
              </ThemedText>
            )}

            {/* The moderator's two actions share a line, pushed to opposite
                ends. Delete used to sit on the row below beside Report and
                Block, and three pills did not fit — Block was cut off at the
                screen edge. Up here it also stays as far from Report as the
                row allows, which is the point: it is the only control in the
                viewer that destroys anything. */}
            {(canDeleteCurrentPhoto || canPromoteCurrentPhoto) && !viewerPhoto?.removedAt && (
              <View style={styles.viewerModRow} pointerEvents="box-none">
                {canDeleteCurrentPhoto ? (
                  <Pressable style={styles.deletePhotoButton} onPress={handleDeletePhoto}>
                    <Ionicons name="trash-outline" size={13} color="#ffffff" />
                    <ThemedText type="smallBold" style={styles.deletePhotoText}>
                      {t('location.deletePhoto')}
                    </ThemedText>
                  </Pressable>
                ) : (
                  <View />
                )}
                {canPromoteCurrentPhoto && (
                  <Pressable style={styles.makeCoverButton} onPress={handleMakeCover}>
                    <Ionicons name="star" size={13} color="#000000" />
                    <ThemedText type="smallBold" style={styles.makeCoverText}>
                      {t('location.makeCoverPhoto')}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            )}

            {/* Only a moderator ever sees a trashed photo at all — everyone
                else has it filtered out before it reaches the gallery. */}
            {canDeleteCurrentPhoto && viewerPhoto?.removedAt && (
              <View style={styles.viewerCoverRow} pointerEvents="box-none">
                <Pressable style={styles.makeCoverButton} onPress={handleRestorePhoto}>
                  <Ionicons name="arrow-undo" size={13} color="#000000" />
                  <ThemedText type="smallBold" style={styles.makeCoverText}>
                    {t('admin.restore')}
                  </ThemedText>
                </Pressable>
              </View>
            )}

            {/* Delete on the far left, away from the pair on the right. It is
                the one control here that destroys something, and it should not
                sit a thumb's width from Report. */}
            <View style={styles.viewerActionRow} pointerEvents="box-none">
              <View style={styles.viewerActionRight} pointerEvents="box-none">
                {canReportCurrentPhoto && (
                  <Pressable
                    style={styles.reportPhotoButton}
                    onPress={() => setReportingPhoto(viewerPhoto)}
                    hitSlop={8}>
                    <Ionicons name="flag" size={13} color="#ffffff" />
                    <ThemedText type="smallBold" style={styles.reportPhotoText}>
                      {t('location.reportPhoto')}
                    </ThemedText>
                  </Pressable>
                )}
                {/* Same pairing as on a review: whoever can report this photo
                    can also stop seeing its uploader entirely. */}
                {canReportCurrentPhoto && viewerPhoto?.uploaderId && (
                  <Pressable
                    style={styles.reportPhotoButton}
                    onPress={() => handleBlockPhotoUploader(viewerPhoto)}
                    hitSlop={8}>
                    <Ionicons name="ban" size={13} color="#ffffff" />
                    <ThemedText type="smallBold" style={styles.reportPhotoText}>
                      {t('safety.blockUser')}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  loadingIndicator: {
    marginTop: Spacing.six,
  },
  centerText: {
    textAlign: 'center',
    marginTop: Spacing.six,
  },
  standaloneBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    margin: Spacing.three,
  },
  scrollContent: {
    paddingBottom: Spacing.six,
  },
  heroWrapper: {
    position: 'relative',
    marginHorizontal: Spacing.three,
    marginTop: Spacing.three,
    borderRadius: 14,
    overflow: 'hidden',
  },
  hero: {
    width: '100%',
    height: 210,
  },
  backButton: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowButton: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoDotsRow: {
    position: 'absolute',
    bottom: Spacing.two,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.half,
  },
  photoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  photoDotActive: {
    backgroundColor: '#ffffff',
  },
  photoCountButton: {
    position: 'absolute',
    bottom: Spacing.two,
    right: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Spacing.five,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  photoCountText: {
    color: '#ffffff',
  },
  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    padding: Spacing.three,
  },
  galleryThumbWrapper: {
    width: '32%',
    aspectRatio: 1,
  },
  galleryThumb: {
    flex: 1,
    borderRadius: Spacing.one,
  },
  viewerRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  viewerPage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
  /*
   * Count and close grouped together on the right, not one in each corner.
   *
   * Anchored to the top of the screen rather than to the top of the photo,
   * which is what the reference drew. The photo is contain-fitted, so its top
   * edge moves with every image's aspect ratio — controls pinned to it would
   * jump up and down as you swipe through a gallery, and would need the image
   * measured on load to place at all. A fixed position that sometimes sits on
   * black and sometimes on the picture is steadier, which is why both carry
   * their own scrim below.
   */
  viewerCloseFloating: {
    position: 'absolute',
  },
  // Same scrim and radius as the close button, so the two read as a pair even
  // at opposite corners of the picture, and both stay legible over a bright
  // photo as well as over the black surround.
  viewerCount: {
    position: 'absolute',
    color: '#ffffff',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Spacing.five,
    overflow: 'hidden',
  },
  viewerCredit: {
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'right',
  },
  reportPhotoStrip: {
    flexGrow: 0,
    marginBottom: Spacing.one,
  },
  reportPhotoThumb: {
    width: 96,
    height: 96,
    borderRadius: Spacing.two,
    marginRight: Spacing.two,
    backgroundColor: 'rgba(128,128,128,0.25)',
  },
  reportPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.five,
    // Not a filled red button. Reporting is a normal thing to be able to do,
    // not a destructive action, and a solid red pill over somebody's photo
    // reads as an accusation before anyone has looked at it.
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  reportPhotoText: {
    color: '#ffffff',
  },
  /*
   * Stretch, not centre. Each row inside now decides its own alignment — the
   * credit and Make cover sit right, the bottom row pushes Delete left and the
   * report pair right — and a centred parent would have overridden all of it.
   */
  viewerFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'stretch',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
  },
  viewerCoverRow: {
    alignItems: 'flex-end',
  },
  viewerModRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  viewerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  viewerActionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  makeCoverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: '#F5C242',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 1,
    borderRadius: Spacing.five,
  },
  deletePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 1,
    borderRadius: Spacing.five,
    backgroundColor: '#E05252',
  },
  deletePhotoText: {
    color: '#ffffff',
  },
  makeCoverText: {
    color: '#000000',
  },
  viewerCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActiveFavorite: {
    color: '#4CD37A',
    fontSize: 22,
  },
  /*
   * No color here on purpose. Unlike the bookmark/favorite cards, this button
   * sits on theme.backgroundElement, not a fixed dark scrim over a photo —
   * a hardcoded white was invisible in light mode. ThemedText already
   * defaults to theme.text when no themeColor is given, which is correct in
   * both themes; this style only needs to set the size.
   */
  squareActionIcon: {
    fontSize: 22,
  },
  body: {
    padding: Spacing.four,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexShrink: 1,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: TEAL_TINT,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.five,
  },
  categoryPillText: {
    color: TEAL,
  },
  otherCategoryDetail: {
    flexShrink: 1,
  },
  editLink: {
    color: TEAL,
  },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    backgroundColor: '#E8A93B',
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.five,
  },
  privateBadgeText: {
    color: '#1A1400',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  name: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
  },
  statusLine: {
    marginTop: Spacing.one,
  },
  addedByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  removeCreditText: {
    color: '#E05252',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
  },
  linkText: {
    color: '#4C8FE8',
    textDecorationLine: 'underline',
  },
  /*
   * The website reads in the page's own text colour instead of link blue: on
   * the dark theme #4C8FE8 against #0A0A0D is a dim smudge, and the address is
   * long enough that it was the hardest line on the screen to read.
   *
   * The underline stays, and is now doing all the work of saying "tappable" —
   * so it is not decoration and must not be dropped.
   */
  linkUnderline: {
    textDecorationLine: 'underline',
  },
  pastNotice: {
    marginTop: Spacing.three,
    lineHeight: 18,
  },
  dateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    // The accent is the same amber in both themes, so one tint works for both.
    backgroundColor: 'rgba(232,169,59,0.12)',
  },
  dateBannerText: {
    flex: 1,
    gap: 2,
  },
  dateRangeText: {
    fontSize: 16,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  directionsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    backgroundColor: '#14747A',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  directionsButtonText: {
    color: DIRECTIONS_TEXT,
  },
  squareActionButton: {
    width: 46,
    height: 46,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    marginTop: Spacing.four,
  },
  readMoreText: {
    color: TEAL,
    marginTop: Spacing.two,
  },
  descriptionText: {
    lineHeight: 22,
  },
  hoursNaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hoursRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  hoursRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  hoursExpandedList: {
    marginTop: Spacing.three,
    gap: Spacing.one,
  },
  hoursDisplayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  adminDeleteButton: {
    height: 44,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(224,82,82,0.15)',
    marginTop: Spacing.five,
  },
  adminDeleteButtonText: {
    color: '#E05252',
  },
  divider: {
    height: 1,
    marginTop: Spacing.five,
    marginBottom: Spacing.four,
  },
  reviewsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 26,
  },
  writeReviewButton: {
    borderWidth: 1,
    borderColor: TEAL,
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  writeReviewButtonText: {
    color: TEAL,
  },
  ratingSummaryRow: {
    flexDirection: 'row',
    gap: Spacing.four,
    marginBottom: Spacing.two,
  },
  ratingSummaryLeft: {
    // No fixed width: the widest thing here used to be "N reviews" stacked
    // under the number, now it's the number and the stars sitting in one
    // row, and that row is wider than 84 ever was. Sizing to content keeps
    // it centered under itself either way rather than clipping the stars.
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
  },
  ratingSummaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  ratingSummaryNumber: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '700',
    // No colour here on purpose. This sits on the page background, not on a
    // button or a photo, so a hardcoded white made the rating invisible in
    // light mode — white on white, with the stars beside it still showing.
    // ThemedText already falls back to theme.text, which is right in both.
  },
  breakdown: {
    flex: 1,
    gap: Spacing.one,
    justifyContent: 'center',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  /*
   * minWidth, not width, and never allowed to wrap.
   *
   * This held "5★" in a fixed 20pt box. That fits at the smallest system font
   * and nothing above it: at Android's default the text is wider than the box,
   * so it wrapped — the digit on one line, the star underneath — and every row
   * of the histogram became two lines tall. Reported as the ratings looking
   * "off" on an S10 and an iPhone 13 while a Fold looked fine, which turned out
   * to be the Fold having been set to the smallest font.
   *
   * A fixed width for text that scales with the reader's settings is the trap.
   * minWidth keeps the five rows aligned with each other, and numberOfLines on
   * the element makes wrapping impossible whatever the font is set to.
   */
  breakdownLabel: {
    minWidth: 20,
  },
  breakdownTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  breakdownFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: STAR_COLOR,
  },
  breakdownCount: {
    // Same reason as breakdownLabel. A place with 100+ reviews would have
    // wrapped this one even at the default font.
    minWidth: 20,
    textAlign: 'right',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.five,
    marginBottom: Spacing.three,
  },
  emptyReviews: {
    marginTop: Spacing.one,
  },
  reviewList: {
    gap: Spacing.three,
  },
  reviewCard: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    position: 'relative',
  },
  reviewActions: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    padding: Spacing.one,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    zIndex: 1,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.half,
    paddingRight: Spacing.four,
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  reviewAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarInitial: {
    color: '#ffffff',
  },
  reviewAuthorColumn: {
    flex: 1,
  },
  reviewTitle: {
    marginTop: Spacing.half,
  },
  reviewBody: {
    fontWeight: '400',
  },
  reviewPhotoRow: {
    marginTop: Spacing.two,
  },
  reviewPhotoThumb: {
    width: 72,
    height: 72,
    borderRadius: Spacing.one,
    marginRight: Spacing.two,
  },
  likeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    marginTop: Spacing.one,
    alignSelf: 'flex-start',
  },
  /*
   * These two menus predate SheetRoot and never went through it, so they also
   * never got its bottom inset — on an S10 the last row of the overflow menu
   * ("Report") sat under the navigation bar. Padded here rather than moved
   * onto SheetRoot, which carries keyboard handling neither of them needs:
   * they are lists of buttons with nothing to type into.
   */
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  modalTitle: {
    fontSize: 20,
    lineHeight: 26,
    marginBottom: Spacing.two,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  menuReportText: {
    color: '#E05252',
  },
  sortOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
});
