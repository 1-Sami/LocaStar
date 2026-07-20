import {
  deleteLocation,
  fetchLocationById,
  fetchLocationPhotos,
  fetchMyClaimForLocation,
  fetchProfile,
  fetchReviews,
  reportLocation,
  reportReview,
  setReviewLiked,
  shareLocation,
  submitBusinessClaim,
  type BusinessClaim,
  type DayKey,
  type LocationDetail,
  type Review,
} from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddToListModal } from '@/components/add-to-list-modal';
import { ClaimBusinessModal } from '@/components/claim-business-modal';
import { ReportModal } from '@/components/report-modal';
import { ShareModal } from '@/components/share-modal';
import { STAR_COLOR, StarRating } from '@/components/star-rating';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSaves } from '@/hooks/use-saves';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { confirmAsync } from '@/lib/confirm';
import { openDirections } from '@/lib/directions';
import { placeholderImage } from '@/lib/location-adapters';
import { buildLocationShareLink } from '@/lib/public-link';
import { supabase } from '@/lib/supabase';

const HOURS_DAYS: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

export default function LocationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { session } = useAuth();
  const { favoriteIds, bucketListIds, toggleFavorite, toggleBucketList } = useSaves();

  const [location, setLocation] = useState<LocationDetail | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [locationReportVisible, setLocationReportVisible] = useState(false);
  const [reportingReviewId, setReportingReviewId] = useState<string | null>(null);
  const [shareVisible, setShareVisible] = useState(false);
  const [addToListVisible, setAddToListVisible] = useState(false);
  const [claimVisible, setClaimVisible] = useState(false);
  const [myClaim, setMyClaim] = useState<BusinessClaim | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [heroWidth, setHeroWidth] = useState(() => Math.min(Dimensions.get('window').width, MaxContentWidth));
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let cancelled = false;
      setLoading(true);
      setActivePhotoIndex(0);
      Promise.all([
        fetchLocationById(supabase, id),
        fetchReviews(supabase, id, session?.user.id),
        fetchLocationPhotos(supabase, id),
      ])
        .then(([locationResult, reviewsResult, photosResult]) => {
          if (cancelled) return;
          setLocation(locationResult);
          setReviews(reviewsResult);
          setPhotos(photosResult);
        })
        .catch(() => {
          if (!cancelled) {
            setLocation(null);
            setReviews([]);
            setPhotos([]);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [id, session?.user.id])
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
            This location couldn't be found.
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const isFavorite = favoriteIds.has(location.id);
  const isBucketListed = bucketListIds.has(location.id);
  const heroImages = photos.length > 0 ? photos : [placeholderImage(location.id)];
  const ratingCounts = [5, 4, 3, 2, 1].map((star) => reviews.filter((r) => r.rating === star).length);
  const maxCount = Math.max(1, ...ratingCounts);
  const myReview = session ? reviews.find((r) => r.user_id === session.user.id) : undefined;

  const handleOpenLocationReport = () => {
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
    if (!session) {
      router.push('/sign-in');
      return;
    }
    setShareVisible(true);
  };

  const handleSendLink = async () => {
    const link = buildLocationShareLink(location.id);
    try {
      await Share.share({ message: `Check out ${location.name} on LocaStar: ${link}`, url: link });
    } catch {
      // user dismissed the share sheet — nothing to do
    }
  };

  const handleOpenAddToList = () => {
    if (!session) {
      router.push('/sign-in');
      return;
    }
    setAddToListVisible(true);
  };

  const handleDeleteLocation = async () => {
    const confirmed = await confirmAsync(
      'Delete this location?',
      `This permanently deletes "${location.name}" and everything tied to it — reviews, photos, saves, and shares. This can't be undone.`,
      'Delete'
    );
    if (!confirmed) return;
    await deleteLocation(supabase, location.id);
    router.back();
  };

  const handleOpenClaim = () => {
    if (!session) {
      router.push('/sign-in');
      return;
    }
    setClaimVisible(true);
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
        ...(myReview
          ? { rating: String(myReview.rating), title: myReview.title ?? '', body: myReview.body ?? '' }
          : {}),
      },
    });
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.heroWrapper} onLayout={(e) => setHeroWidth(e.nativeEvent.layout.width)}>
            <ScrollView
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
                <Image key={index} source={{ uri }} style={[styles.hero, { width: heroWidth }]} contentFit="cover" />
              ))}
            </ScrollView>
            <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="arrow-back" size={22} color="#ffffff" />
            </Pressable>
            <View style={styles.heroIconRow}>
              <Pressable style={styles.heroIconButton} onPress={() => toggleFavorite(location.id)} hitSlop={8}>
                <ThemedText style={isFavorite ? styles.iconActiveFavorite : styles.iconInactive}>
                  {isFavorite ? '♥' : '♡'}
                </ThemedText>
              </Pressable>
              <Pressable style={styles.heroIconButton} onPress={() => toggleBucketList(location.id)} hitSlop={8}>
                <ThemedText style={isBucketListed ? styles.iconActiveBucket : styles.iconInactive}>
                  {isBucketListed ? '★' : '☆'}
                </ThemedText>
              </Pressable>
              {(location.visibility !== 'private' || session?.user.id === location.created_by) && (
                <Pressable
                  style={styles.heroIconButton}
                  onPress={handleOpenShare}
                  hitSlop={8}
                  accessibilityLabel="Share this location">
                  <Ionicons name="share-outline" size={20} color="#ffffff" />
                </Pressable>
              )}
              {location.visibility !== 'private' && (
                <Pressable
                  style={styles.heroIconButton}
                  onPress={handleSendLink}
                  hitSlop={8}
                  accessibilityLabel="Send a link to a friend">
                  <Ionicons name="link-outline" size={20} color="#ffffff" />
                </Pressable>
              )}
              <Pressable
                style={styles.heroIconButton}
                onPress={handleOpenLocationReport}
                hitSlop={8}
                accessibilityLabel="Report this location">
                <Ionicons name="flag-outline" size={20} color="#ffffff" />
              </Pressable>
            </View>
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
                  <ThemedText type="small" themeColor="textSecondary">
                    {location.category_label.toUpperCase()}
                  </ThemedText>
                )}
                {location.visibility === 'private' && (
                  <View style={styles.privateBadge}>
                    <Ionicons name="lock-closed" size={11} color="#1A1400" />
                    <ThemedText type="small" style={styles.privateBadgeText}>
                      Private
                    </ThemedText>
                  </View>
                )}
              </View>
              {session?.user.id === location.created_by && (
                <Pressable onPress={() => router.push({ pathname: '/edit-location', params: { id: location.id } })}>
                  <ThemedText type="linkPrimary">Edit</ThemedText>
                </Pressable>
              )}
            </View>
            <View style={styles.nameRow}>
              <ThemedText type="default" style={styles.name}>
                {location.name}
              </ThemedText>
              {location.is_verified && <Ionicons name="checkmark-circle" size={20} color="#4CD37A" />}
            </View>

            <View style={styles.ratingRow}>
              <StarRating rating={location.avg_rating} size={18} />
              <ThemedText type="default">
                {location.avg_rating.toFixed(1)} · {location.review_count} reviews
              </ThemedText>
            </View>

            {location.address && (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={18} color={theme.textSecondary} />
                <ThemedText type="default" themeColor="textSecondary" style={styles.infoText}>
                  {location.address}
                </ThemedText>
              </View>
            )}

            {location.creator_visible && location.creator_username && (
              <ThemedText type="small" themeColor="textSecondary">
                Added by @{location.creator_username}
              </ThemedText>
            )}

            {location.is_verified ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.claimText}>
                ✓ Verified business
              </ThemedText>
            ) : myClaim?.status === 'pending' ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.claimText}>
                Claim pending review
              </ThemedText>
            ) : (
              <Pressable onPress={handleOpenClaim}>
                <ThemedText type="linkPrimary" style={styles.claimText}>
                  Claim this business
                </ThemedText>
              </Pressable>
            )}

            <View style={styles.actionButtonsRow}>
              <Pressable
                style={styles.directionsButton}
                onPress={() => openDirections(location.address ?? location.name)}>
                <Ionicons name="navigate-outline" size={18} color="#ffffff" />
                <ThemedText type="smallBold" style={styles.directionsButtonText}>
                  Directions
                </ThemedText>
              </Pressable>
              <Pressable style={styles.addToListButton} onPress={handleOpenAddToList}>
                <Ionicons name="bookmark-outline" size={18} color={theme.text} />
                <ThemedText type="smallBold">Add to list</ThemedText>
              </Pressable>
            </View>

            {location.description && (
              <ThemedText type="default" style={styles.description}>
                {location.description}
              </ThemedText>
            )}

            {location.hours && Object.keys(location.hours).length > 0 && (
              <View style={styles.hoursSection}>
                <ThemedText type="smallBold">Opening hours</ThemedText>
                {HOURS_DAYS.map((day) => {
                  const entry = location.hours?.[day.key];
                  return (
                    <View key={day.key} style={styles.hoursDisplayRow}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {day.label}
                      </ThemedText>
                      <ThemedText type="small" themeColor={entry ? undefined : 'textSecondary'}>
                        {entry ? `${entry.open} – ${entry.close}` : 'Closed'}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />

            <View style={styles.reviewsHeaderRow}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                Reviews <ThemedText themeColor="textSecondary">{reviews.length}</ThemedText>
              </ThemedText>
              <Pressable onPress={handleWriteReview}>
                <ThemedText type="linkPrimary">{myReview ? 'Edit your review' : 'Write a review'}</ThemedText>
              </Pressable>
            </View>

            {reviews.length > 0 && (
              <View style={styles.breakdown}>
                {[5, 4, 3, 2, 1].map((star, index) => (
                  <View key={star} style={styles.breakdownRow}>
                    <ThemedText type="small" style={styles.breakdownLabel}>
                      {star} ★
                    </ThemedText>
                    <View style={[styles.breakdownTrack, { backgroundColor: theme.backgroundElement }]}>
                      <View
                        style={[
                          styles.breakdownFill,
                          { width: `${(ratingCounts[index] / maxCount) * 100}%` },
                        ]}
                      />
                    </View>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.breakdownCount}>
                      {ratingCounts[index]}
                    </ThemedText>
                  </View>
                ))}
              </View>
            )}

            {reviews.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyReviews}>
                No reviews yet — be the first to write one!
              </ThemedText>
            ) : (
              <View style={styles.reviewList}>
                {reviews.map((review) => (
                  <View
                    key={review.id}
                    style={[styles.reviewCard, { borderBottomColor: theme.backgroundElement }]}>
                    <View style={styles.reviewHeader}>
                      <Image
                        source={{ uri: review.author_avatar_url ?? placeholderImage(`avatar-${review.id}`) }}
                        style={styles.reviewAvatar}
                      />
                      <View style={styles.reviewAuthorColumn}>
                        <ThemedText type="smallBold">{review.author_name}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {new Date(review.created_at).toLocaleDateString()}
                        </ThemedText>
                      </View>
                      <Pressable onPress={() => handleOpenReviewReport(review.id)} hitSlop={8}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Report
                        </ThemedText>
                      </Pressable>
                    </View>
                    <StarRating rating={review.rating} size={14} />
                    {review.title && (
                      <ThemedText type="smallBold" style={styles.reviewTitle}>
                        {review.title}
                      </ThemedText>
                    )}
                    {review.body && <ThemedText type="default">{review.body}</ThemedText>}
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

            {isAdmin && (
              <Pressable style={styles.adminDeleteButton} onPress={handleDeleteLocation}>
                <ThemedText type="smallBold" style={styles.adminDeleteButtonText}>
                  Delete this {location.kind} (admin)
                </ThemedText>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      <ReportModal
        visible={locationReportVisible}
        title="Report this location"
        confirmationText="Our team will review this location."
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
        title="Report this review"
        confirmationText="Our team will review this review."
        onClose={() => setReportingReviewId(null)}
        onSubmit={async (reason, details) => {
          if (!session || !reportingReviewId) return;
          await reportReview(supabase, {
            reviewId: reportingReviewId,
            reporterId: session.user.id,
            reason,
            details,
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
  },
  hero: {
    width: '100%',
    height: 260,
  },
  backButton: {
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconRow: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  heroIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  photoDotActive: {
    backgroundColor: '#ffffff',
  },
  iconInactive: {
    color: '#ffffff',
    fontSize: 20,
  },
  iconActiveFavorite: {
    color: '#4CD37A',
    fontSize: 20,
  },
  iconActiveBucket: {
    color: '#F5C242',
    fontSize: 20,
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
    marginTop: Spacing.half,
  },
  name: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
  },
  claimText: {
    marginTop: Spacing.one,
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
  infoText: {
    flex: 1,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    backgroundColor: '#14747A',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  directionsButtonText: {
    color: '#ffffff',
  },
  addToListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    backgroundColor: 'rgba(128,128,128,0.2)',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  description: {
    marginTop: Spacing.four,
  },
  hoursSection: {
    marginTop: Spacing.four,
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
  breakdown: {
    gap: Spacing.one,
    marginBottom: Spacing.four,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  breakdownLabel: {
    width: 32,
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
    width: 20,
    textAlign: 'right',
  },
  emptyReviews: {
    marginTop: Spacing.one,
  },
  reviewList: {
    gap: Spacing.four,
  },
  reviewCard: {
    gap: Spacing.one,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.half,
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  reviewAuthorColumn: {
    flex: 1,
  },
  reviewTitle: {
    marginTop: Spacing.half,
  },
  likeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    marginTop: Spacing.one,
    alignSelf: 'flex-start',
  },
});
