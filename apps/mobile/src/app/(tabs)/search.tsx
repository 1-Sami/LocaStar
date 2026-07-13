import { fetchNearbyLocations, type NearbyLocation } from '@locastar/shared';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LocationCard } from '@/components/location-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSaves } from '@/hooks/use-saves';
import { useTheme } from '@/hooks/use-theme';
import { useUserLocation } from '@/hooks/use-user-location';
import { nearbyLocationToCard } from '@/lib/location-adapters';
import { supabase } from '@/lib/supabase';

// Effectively "no radius limit" — search isn't restricted to nearby-only like Home is.
const SEARCH_RADIUS_M = 20_000_000;

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NearbyLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const { coords } = useUserLocation();
  const { favoriteIds, bucketListIds, toggleFavorite, toggleBucketList } = useSaves();

  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    const trimmed = query.trim();

    const timeout = setTimeout(() => {
      setLoading(true);
      fetchNearbyLocations(supabase, {
        lat: coords.latitude,
        lng: coords.longitude,
        radiusM: SEARCH_RADIUS_M,
        searchQuery: trimmed.length > 0 ? trimmed : null,
      })
        .then((result) => {
          if (!cancelled) setResults(result);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [coords, query]);

  const cards = results.map(nearbyLocationToCard);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedView type="backgroundElement" style={styles.searchBar}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </ThemedView>

        <ThemedText type="small" themeColor="textSecondary" style={styles.countText}>
          {loading ? 'Searching…' : `Total ${cards.length}`}
        </ThemedText>

        {loading ? (
          <ActivityIndicator style={styles.loadingIndicator} />
        ) : (
          <FlatList
            data={cards}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                No matches.
              </ThemedText>
            }
            renderItem={({ item }) => (
              <LocationCard
                location={item}
                isFavorite={favoriteIds.has(item.id)}
                isBucketListed={bucketListIds.has(item.id)}
                onToggleFavorite={() => toggleFavorite(item.id)}
                onToggleBucketList={() => toggleBucketList(item.id)}
              />
            )}
          />
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
  searchBar: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
  },
  searchInput: {
    height: 44,
    fontSize: 16,
  },
  countText: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  loadingIndicator: {
    marginTop: Spacing.six,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: Spacing.six,
  },
});
