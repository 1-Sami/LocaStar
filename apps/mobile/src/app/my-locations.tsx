import { fetchMyAddedLocations, type MyAddedLocation } from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { categoryLabelFromName } from '@/lib/categories';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StarRating } from '@/components/star-rating';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { formatActivityRange } from '@/lib/activity-dates';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

// Purple for places, brown for activities — the same split the Add tab and the
// Profile menu already use (a place is #C34CE8 purple, an activity #E8A93B
// amber). The amber is darkened here because a full-strength gold outline on a
// dark card competes with the star rating sitting inside it.
const PLACE_BORDER = '#C34CE8';
const ACTIVITY_BORDER = '#8A6A2A';

/**
 * When an activity runs, as one line.
 *
 * Only activities carry dates; a place returns null and shows nothing. The
 * formatting itself lives in lib/activity-dates so this screen and the location
 * screen cannot drift apart again — they already had, and both had English
 * words baked into a translated app.
 */
function dateLine(location: MyAddedLocation, language: string, t: TFunction): string | null {
  if (location.kind !== 'activity') return null;
  return formatActivityRange(location.starts_at, location.expires_at, language, t);
}

/** Past its end date. Keyed on expires_at: without one it never ends. */
function hasEnded(location: MyAddedLocation): boolean {
  return Boolean(location.expires_at && new Date(location.expires_at).getTime() < Date.now());
}

export default function MyLocationsScreen() {
  const { t, i18n } = useTranslation();
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
            {t('myContributions.noLocations')}
          </ThemedText>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {locations.map((location) => {
              const isActivity = location.kind === 'activity';
              const runs = dateLine(location, i18n.language, t);
              const ended = hasEnded(location);
              return (
                <Pressable
                  key={location.id}
                  style={[styles.card, { borderColor: isActivity ? ACTIVITY_BORDER : PLACE_BORDER }]}
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
                      {isActivity ? 'Activity' : 'Location'}
                      {location.category_label
                        ? ` · ${categoryLabelFromName(t, location.category_label)}`
                        : ''}
                    </ThemedText>
                  </View>
                  {runs && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {runs}
                    </ThemedText>
                  )}
                  <View style={styles.ratingRow}>
                    <StarRating rating={location.avg_rating} size={13} />
                    <ThemedText type="small" themeColor="textSecondary" style={styles.ratingText}>
                      {location.avg_rating.toFixed(1)} · {location.review_count} reviews
                    </ThemedText>
                    {ended && (
                      <ThemedText type="small" style={styles.endedText}>
                        {t('myContributions.ended')}
                      </ThemedText>
                    )}
                  </View>
                </Pressable>
              );
            })}
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
  // A full outline rather than the old bottom hairline: the border is what
  // tells a place apart from an activity at a glance, so it has to enclose.
  card: {
    gap: Spacing.half,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.two,
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
  ratingText: {
    flex: 1,
  },
  endedText: {
    color: '#E05252',
  },
});
