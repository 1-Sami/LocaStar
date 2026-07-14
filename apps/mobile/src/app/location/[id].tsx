import { fetchLocationById, fetchReviews, type LocationDetail, type Review } from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { STAR_COLOR, StarRating } from '@/components/star-rating';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSaves } from '@/hooks/use-saves';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { openDirections } from '@/lib/directions';
import { placeholderImage } from '@/lib/location-adapters';
import { supabase } from '@/lib/supabase';

export default function LocationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { session } = useAuth();
  const { favoriteIds, bucketListIds, toggleFavorite, toggleBucketList } = useSaves();

  const [location, setLocation] = useState<LocationDetail | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let cancelled = false;
      setLoading(true);
      Promise.all([fetchLocationById(supabase, id), fetchReviews(supabase, id)])
        .then(([locationResult, reviewsResult]) => {
          if (cancelled) return;
          setLocation(locationResult);
          setReviews(reviewsResult);
        })
        .catch(() => {
          if (!cancelled) {
            setLocation(null);
            setReviews([]);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [id])
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
  const ratingCounts = [5, 4, 3, 2, 1].map((star) => reviews.filter((r) => r.rating === star).length);
  const maxCount = Math.max(1, ...ratingCounts);
  const myReview = session ? reviews.find((r) => r.user_id === session.user.id) : undefined;

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
          <View style={styles.heroWrapper}>
            <Image source={{ uri: placeholderImage(location.id) }} style={styles.hero} contentFit="cover" />
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
            </View>
          </View>

          <View style={styles.body}>
            {location.category_label && (
              <ThemedText type="small" themeColor="textSecondary">
                {location.category_label.toUpperCase()}
              </ThemedText>
            )}
            <ThemedText type="default" style={styles.name}>
              {location.name}
            </ThemedText>

            <View style={styles.ratingRow}>
              <StarRating rating={location.avg_rating} size={18} />
              <ThemedText type="default">
                {location.avg_rating.toFixed(2)} · {location.review_count} reviews
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

            <Pressable
              style={styles.directionsButton}
              onPress={() => openDirections(location.address ?? location.name)}>
              <Ionicons name="navigate-outline" size={18} color="#ffffff" />
              <ThemedText type="smallBold" style={styles.directionsButtonText}>
                Directions
              </ThemedText>
            </Pressable>

            {location.description && (
              <ThemedText type="default" style={styles.description}>
                {location.description}
              </ThemedText>
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
                    </View>
                    <StarRating rating={review.rating} size={14} />
                    {review.title && (
                      <ThemedText type="smallBold" style={styles.reviewTitle}>
                        {review.title}
                      </ThemedText>
                    )}
                    {review.body && <ThemedText type="default">{review.body}</ThemedText>}
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
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
  name: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    marginTop: Spacing.half,
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
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    backgroundColor: '#14747A',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    marginTop: Spacing.three,
  },
  directionsButtonText: {
    color: '#ffffff',
  },
  description: {
    marginTop: Spacing.four,
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
});
