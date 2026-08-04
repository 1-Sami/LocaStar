import { fetchCategories, fetchNearbyLocations, type Category, type NearbyLocation } from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryChip } from '@/components/category-chip';
import { LocationCard } from '@/components/location-card';
import { BottomTabInset, Fonts, MaxContentWidth, SearchPalette, Spacing } from '@/constants/theme';
import { useSaves } from '@/hooks/use-saves';
import { useUserLocation } from '@/hooks/use-user-location';
import { nearbyLocationToCard } from '@/lib/location-adapters';
import { supabase } from '@/lib/supabase';

// Effectively "no radius limit" — search isn't restricted to nearby-only like Home is.
const SEARCH_RADIUS_M = 20_000_000;

const SORT_OPTIONS = [
  { key: 'distance', label: 'Distance' },
  { key: 'rating', label: 'Highest rated' },
] as const;

// Pink → silver → green sheen for the "Filter" chip's border.
const FILTER_BORDER_GRADIENT = ['#E84CA9', '#C9CDD3', '#4CD37A'] as const;

export default function SearchScreen() {
  const { season: initialSeason, sort: initialSort } = useLocalSearchParams<{ season?: string; sort?: string }>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NearbyLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { coords } = useUserLocation();
  const { favoriteIds, bucketListIds, toggleFavorite, toggleBucketList } = useSaves();

  const [categories, setCategories] = useState<Category[]>([]);
  const [activeSlugs, setActiveSlugs] = useState<string[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [sortBy, setSortBy] = useState<'distance' | 'rating'>(initialSort === 'rating' ? 'rating' : 'distance');
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [activeSeason, setActiveSeason] = useState<'summer' | 'winter' | null>(
    initialSeason === 'summer' || initialSeason === 'winter' ? initialSeason : null
  );
  // Results used to load once and never again, so a location added since the
  // app started never showed up. Bumping this on focus re-runs the query.
  const [refreshKey, setRefreshKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((key) => key + 1);
    }, [])
  );

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
        season: activeSeason,
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
  }, [coords, query, activeSlugs, sortBy, activeSeason, refreshKey]);

  const cards = results.map(nearbyLocationToCard);
  const sortLabel = SORT_OPTIONS.find((o) => o.key === sortBy)?.label ?? 'Sort';

  const trimmedCategoryQuery = categoryQuery.trim().toLowerCase();
  const visibleCategories = trimmedCategoryQuery
    ? categories.filter((c) => c.name.toLowerCase().includes(trimmedCategoryQuery))
    : categories;

  // Reset the search each time the picker closes so it reopens showing everything.
  const closePicker = () => {
    setPickerVisible(false);
    setCategoryQuery('');
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.exploreHeader}>
          <Text style={styles.exploreTitle}>Explore</Text>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-sharp" size={16} color={SearchPalette.textMuted} style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="SEARCH PLACES"
            placeholderTextColor={SearchPalette.textMuted}
            style={styles.searchInput}
          />
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={styles.filterRowContent}
          data={categories.filter((c) => activeSlugs.includes(c.slug))}
          keyExtractor={(item) => item.slug}
          ListHeaderComponent={
            <Pressable onPress={() => setPickerVisible(true)}>
              <LinearGradient
                colors={FILTER_BORDER_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.filterButtonGradient}>
                <View style={styles.filterButton}>
                  <Ionicons name="options-sharp" size={15} color={SearchPalette.text} />
                  <Text style={styles.filterButtonText}>FILTER</Text>
                </View>
              </LinearGradient>
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

        {(activeSlugs.length > 0 || activeSeason !== null) && (
          <Pressable
            style={styles.resetFiltersButton}
            onPress={() => {
              setActiveSlugs([]);
              setActiveSeason(null);
            }}>
            <Text style={styles.resetFiltersText}>Reset filter</Text>
          </Pressable>
        )}

        <View style={styles.metaRow}>
          <Text style={styles.resultsCountText}>{loading ? 'SEARCHING…' : `${cards.length} RESULTS`}</Text>
          <Pressable style={styles.sortButton} onPress={() => setSortMenuVisible(true)}>
            <Text style={styles.sortButtonText}>{sortLabel.toUpperCase()}</Text>
            <Ionicons name="swap-vertical-sharp" size={14} color={SearchPalette.text} />
          </Pressable>
        </View>

        {/*
          Only take the list away for the very first load. Swapping it for a
          spinner on every refresh unmounts it, which throws away how far the
          person had scrolled — so coming back from a location started at the
          top again.
        */}
        {loading && cards.length === 0 ? (
          <ActivityIndicator style={styles.loadingIndicator} color={SearchPalette.accent} />
        ) : (
          <FlatList
            data={cards}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={styles.emptyText}>No matches.</Text>}
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


      <Modal visible={pickerVisible} animationType="slide" transparent onRequestClose={closePicker}>
        {/* The sheet is anchored to the bottom, so the keyboard opened straight
            over the activity search box you were typing into. A Modal is its own
            window on Android and does not inherit the activity's adjustResize,
            so this has to be handled here rather than in app.json. */}
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {/* Backdrop as a sibling rather than a wrapper: wrapping the sheet in
              a Pressable would make every tap inside it dismiss the sheet. */}
          <Pressable style={StyleSheet.absoluteFill} onPress={closePicker} />
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Filter</Text>

            <Text style={styles.modalSectionLabel}>SEASON</Text>
            <View style={styles.modalSeasonRow}>
              <Pressable
                style={[styles.modalSeasonChip, activeSeason === 'summer' && styles.modalSeasonChipActive]}
                onPress={() => setActiveSeason((current) => (current === 'summer' ? null : 'summer'))}>
                <Text
                  style={[styles.modalSeasonChipText, activeSeason === 'summer' && styles.modalSeasonChipTextActive]}>
                  ☀ Summer
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modalSeasonChip, activeSeason === 'winter' && styles.modalSeasonChipActive]}
                onPress={() => setActiveSeason((current) => (current === 'winter' ? null : 'winter'))}>
                <Text
                  style={[styles.modalSeasonChipText, activeSeason === 'winter' && styles.modalSeasonChipTextActive]}>
                  ❄ Winter
                </Text>
              </Pressable>
            </View>

            <Text style={styles.modalSectionLabel}>ACTIVITIES</Text>
            <View style={styles.categorySearchBar}>
              <Ionicons name="search-sharp" size={15} color={SearchPalette.textMuted} />
              <TextInput
                value={categoryQuery}
                onChangeText={setCategoryQuery}
                placeholder="Search activities"
                placeholderTextColor={SearchPalette.textMuted}
                style={styles.categorySearchInput}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {categoryQuery.length > 0 && (
                <Pressable onPress={() => setCategoryQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={SearchPalette.textMuted} />
                </Pressable>
              )}
            </View>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              {visibleCategories.length === 0 ? (
                <Text style={styles.modalEmptyText}>No activities match that search.</Text>
              ) : (
                visibleCategories.map((category) => {
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
                      <Text style={styles.modalRowText}>{category.name}</Text>
                      {active && <Ionicons name="checkmark" size={18} color={SearchPalette.accent} />}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={sortMenuVisible} animationType="slide" transparent onRequestClose={() => setSortMenuVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSortMenuVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sort by</Text>
            {SORT_OPTIONS.map((option) => (
              <Pressable
                key={option.key}
                style={styles.modalRow}
                onPress={() => {
                  setSortBy(option.key);
                  setSortMenuVisible(false);
                }}>
                <Text style={styles.modalRowText}>{option.label}</Text>
                {sortBy === option.key && <Ionicons name="checkmark" size={18} color={SearchPalette.accent} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const MONO_FONT = Fonts.mono;
const SERIF_FONT = Fonts.serif;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SearchPalette.background,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  // Plain text on the page background — no pill or panel behind the title.
  exploreHeader: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
    marginHorizontal: Spacing.three,
  },
  exploreTitle: {
    fontFamily: SERIF_FONT,
    fontSize: 24,
    fontWeight: '700',
    color: SearchPalette.text,
  },
  searchBar: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SearchPalette.inputBorder,
    backgroundColor: SearchPalette.card,
    paddingHorizontal: Spacing.three,
  },
  searchIcon: {
    marginRight: Spacing.two,
  },
  searchInput: {
    flex: 1,
    fontFamily: MONO_FONT,
    fontSize: 13,
    letterSpacing: 0.5,
    color: SearchPalette.text,
  },
  filterRow: {
    flexGrow: 0,
    flexShrink: 0,
    height: 44,
    marginTop: Spacing.three,
  },
  filterRowContent: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    alignItems: 'center',
  },
  filterButtonGradient: {
    borderRadius: 10,
    padding: 1.5,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    // Fixed height rather than padding around the text: a padding-driven pill
    // is sized from font metrics, so it got squeezed and clipped its label when
    // the keyboard opened. Matches the category chips.
    height: 34,
    borderRadius: 8.5,
    backgroundColor: SearchPalette.card,
  },
  filterButtonText: {
    fontFamily: MONO_FONT,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: SearchPalette.text,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  resetFiltersButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.one,
  },
  resetFiltersText: {
    fontFamily: MONO_FONT,
    fontSize: 12,
    color: SearchPalette.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginTop: Spacing.four,
  },
  resultsCountText: {
    fontFamily: MONO_FONT,
    fontSize: 12,
    letterSpacing: 0.5,
    color: SearchPalette.textMuted,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  sortButtonText: {
    fontFamily: MONO_FONT,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: SearchPalette.text,
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  loadingIndicator: {
    marginTop: Spacing.six,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: Spacing.six,
    color: SearchPalette.textMuted,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    maxHeight: '70%',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
    backgroundColor: SearchPalette.card,
  },
  modalTitle: {
    fontFamily: MONO_FONT,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: SearchPalette.text,
    marginBottom: Spacing.two,
  },
  modalSectionLabel: {
    fontFamily: MONO_FONT,
    fontSize: 12,
    letterSpacing: 0.5,
    color: SearchPalette.textMuted,
  },
  modalSeasonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  modalSeasonChip: {
    borderWidth: 1,
    borderColor: SearchPalette.inputBorder,
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  modalSeasonChipActive: {
    backgroundColor: SearchPalette.accent,
    borderColor: SearchPalette.accent,
  },
  modalSeasonChipText: {
    color: SearchPalette.text,
  },
  modalSeasonChipTextActive: {
    color: '#0A0A0A',
    fontWeight: '700',
  },
  categorySearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SearchPalette.inputBorder,
    backgroundColor: SearchPalette.background,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.one,
  },
  categorySearchInput: {
    flex: 1,
    fontSize: 15,
    color: SearchPalette.text,
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalEmptyText: {
    color: SearchPalette.textMuted,
    paddingVertical: Spacing.three,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SearchPalette.hairline,
  },
  modalRowText: {
    color: SearchPalette.text,
    fontSize: 16,
  },
});
