import { fetchMyReviews, type MyReview } from '@locastar/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StarRating } from '@/components/star-rating';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

export default function MyReviewsScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const router = useRouter();
  const [reviews, setReviews] = useState<MyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!session) {
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);
      setLoadFailed(false);
      fetchMyReviews(supabase, session.user.id)
        .then((rows) => {
          if (!cancelled) setReviews(rows);
        })
        .catch((err) => {
          // "You haven't written any reviews" when you have written nine reads
          // as your work having been deleted, not as a failed request.
          console.error('Failed to load your reviews', err);
          if (!cancelled) setLoadFailed(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [session])
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        {loading ? (
          <ActivityIndicator style={styles.loadingIndicator} />
        ) : loadFailed ? (
          <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
            {t('common.somethingWentWrong')}
          </ThemedText>
        ) : reviews.length === 0 ? (
          <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
            {t('myContributions.noReviews')}
          </ThemedText>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {reviews.map((review) => (
              <Pressable
                key={review.id}
                style={styles.reviewCard}
                onPress={() => router.push({ pathname: '/location/[id]', params: { id: review.location_id } })}>
                <ThemedText type="smallBold">{review.location_name}</ThemedText>
                <View style={styles.ratingRow}>
                  <StarRating rating={review.rating} size={14} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {new Date(review.created_at).toLocaleDateString()}
                  </ThemedText>
                </View>
                {review.title && <ThemedText type="smallBold">{review.title}</ThemedText>}
                {review.body && <ThemedText type="default">{review.body}</ThemedText>}
              </Pressable>
            ))}
          </ScrollView>
        )}
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
  emptyText: {
    textAlign: 'center',
    marginTop: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  scrollContent: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  reviewCard: {
    gap: Spacing.one,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
