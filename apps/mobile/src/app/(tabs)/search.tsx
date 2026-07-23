import { fetchCategories, fetchNearbyLocations, type Category, type NearbyLocation } from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryChip } from '@/components/category-chip';
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

const SORT_OPTIONS = [
  { key: 'distance', label: 'Distance' },
  { key: 'rating', label: 'Highest rated' },
] as const;

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NearbyLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const router = useRouter();
  const { coords } = useUserLocation();
  const { favoriteIds, bucketListIds, toggleFavorite, toggleBucketList } = useSaves();

  const [categories, setCategories] = useState<Category[]>([]);
  const [activeSlugs, setActiveSlugs] = useState<string[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [sortBy, setSortBy] = useState<'distance' | 'rating'>('distance');
  const [sortMenuVisible, setSortMenuVisible] = useState(false);

  useEffect(() => {
    fetchCategories(supabase)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

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
        categorySlugs: activeSlugs,
        searchQuery: trimmed.length > 0 ? trimmed : null,
        sort: sortBy,
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
  }, [coords, query, activeSlugs, sortBy]);

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

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={styles.filterRowContent}
          data={categories.filter((c) => activeSlugs.includes(c.slug))}
          keyExtractor={(item) => item.slug}
          ListHeaderComponent={
            <Pressable style={styles.activitiesButton} onPress={() => setPickerVisible(true)}>
              <Ionicons name="filter" size={16} color="#ffffff" />
              <ThemedText type="smallBold" style={styles.activitiesButtonText}>
                Activities ▾
              </ThemedText>
            </Pressable>
          }
          renderItem={({ item }) => (
            <CategoryChip
              label={item.name}
              categorySlug={item.slug}
              onRemove={() => setActiveSlugs((current) => current.filter((s) => s !== item.slug))}
            />
          )}
        />

        {activeSlugs.length > 0 && (
          <Pressable style={styles.resetFiltersButton} onPress={() => setActiveSlugs([])}>
            <Ionicons name="close-circle-outline" size={14} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">
              Reset filters
            </ThemedText>
          </Pressable>
        )}

        <View style={styles.metaRow}>
          <ThemedText type="small" themeColor="textSecondary">
            {loading ? 'Searching…' : `Total ${cards.length}`}
          </ThemedText>
          <Pressable
            style={[styles.sortButton, { backgroundColor: theme.backgroundSelected }]}
            onPress={() => setSortMenuVisible(true)}>
            <ThemedText type="small">{SORT_OPTIONS.find((o) => o.key === sortBy)?.label ?? 'Sort'}</ThemedText>
            <Ionicons name="chevron-down" size={14} color={theme.text} />
          </Pressable>
        </View>

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
                onPress={() => router.push({ pathname: '/location/[id]', params: { id: item.id } })}
              />
            )}
          />
        )}
      </SafeAreaView>

      <Modal visible={pickerVisible} animationType="slide" transparent onRequestClose={() => setPickerVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerVisible(false)}>
          <ThemedView type="backgroundElement" style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              Activities
            </ThemedText>
            <ScrollView style={styles.modalScroll}>
              {categories.map((category) => {
                const active = activeSlugs.includes(category.slug);
                return (
                  <Pressable
                    key={category.slug}
                    style={styles.modalRow}
                    onPress={() =>
                      setActiveSlugs((current) =>
                        active ? current.filter((s) => s !== category.slug) : [...current, category.slug]
                      )
                    }>
                    <ThemedText type="default">{category.name}</ThemedText>
                    <ThemedText type="default">{active ? '✓' : ''}</ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </ThemedView>
        </Pressable>
      </Modal>

      <Modal visible={sortMenuVisible} animationType="slide" transparent onRequestClose={() => setSortMenuVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSortMenuVisible(false)}>
          <ThemedView type="backgroundElement" style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              Sort by
            </ThemedText>
            {SORT_OPTIONS.map((option) => (
              <Pressable
                key={option.key}
                style={styles.modalRow}
                onPress={() => {
                  setSortBy(option.key);
                  setSortMenuVisible(false);
                }}>
                <ThemedText type="default">{option.label}</ThemedText>
                <ThemedText type="default">{sortBy === option.key ? '✓' : ''}</ThemedText>
              </Pressable>
            ))}
          </ThemedView>
        </Pressable>
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
  filterRow: {
    flexGrow: 0,
    minHeight: 44,
    marginTop: Spacing.three,
  },
  filterRowContent: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    gap: Spacing.two,
    alignItems: 'center',
  },
  activitiesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: '#B5432E',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    marginRight: Spacing.two,
  },
  activitiesButtonText: {
    color: '#ffffff',
  },
  resetFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginTop: Spacing.four,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.five,
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
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    maxHeight: '70%',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  modalTitle: {
    fontSize: 20,
    lineHeight: 26,
    marginBottom: Spacing.two,
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
});
