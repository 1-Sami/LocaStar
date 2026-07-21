import { fetchMyAddedLocations, type MyAddedLocation } from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StarRating } from '@/components/star-rating';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

export default function MyLocationsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [locations, setLocations] = useState<MyAddedLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!session) {
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);
      fetchMyAddedLocations(supabase, session.user.id)
        .then((rows) => {
          if (!cancelled) setLocations(rows);
        })
        .catch(() => {
          if (!cancelled) setLocations([]);
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
        ) : locations.length === 0 ? (
          <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
            You haven't added any locations or activities yet.
          </ThemedText>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {locations.map((location) => (
              <Pressable
                key={location.id}
                style={styles.card}
                onPress={() => router.push({ pathname: '/location/[id]', params: { id: location.id } })}>
                <View style={styles.titleRow}>
                  <ThemedText type="smallBold" style={styles.name} numberOfLines={1}>
                    {location.name}
                  </ThemedText>
                  {location.is_verified && <Ionicons name="checkmark-circle" size={16} color="#4CD37A" />}
                  {location.visibility === 'private' && (
                    <Ionicons name="lock-closed" size={13} color="#E8A93B" />
                  )}
                </View>
                <View style={styles.metaRow}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {location.kind === 'activity' ? 'Activity' : 'Location'}
                    {location.category_label ? ` · ${location.category_label}` : ''}
                  </ThemedText>
                </View>
                <View style={styles.ratingRow}>
                  <StarRating rating={location.avg_rating} size={13} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {location.avg_rating.toFixed(1)} · {location.review_count} reviews
                  </ThemedText>
                </View>
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
    gap: Spacing.three,
  },
  card: {
    gap: Spacing.half,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.25)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  name: {
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
