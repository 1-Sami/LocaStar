import { fetchCategories, fetchNearbyLocations, type Category, type NearbyLocation } from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

/*
 * Locations per page, fetched as you reach the bottom.
 *
 * The count above the list is the real total from the database, not this — the
 * two used to be the same number, which is why Search insisted there were 100
 * results when there were 801. See migration 0087.
 */
const PAGE_SIZE = 50;

/*
 * Ceiling on the refresh-in-place query.
 *
 * Returning to the tab re-asks for as many rows as are already shown so the
 * scroll position survives. Somebody who has scrolled a very long way should
 * not turn that into a thousand-row request every time they glance at a
 * location and come back; past this they get the top of the list again.
 */
const MAX_REFRESH_ROWS = 300;

// Key and label kept apart: the key is compared and stored, the label is only
// ever displayed. Sharing one string between the two is what broke the Profile
// menu the moment it was translated.
const SORT_OPTIONS = [
  { key: 'distance', labelKey: 'search.sortDistance' },
  { key: 'rating', labelKey: 'search.sortRating' },
] as const;

// Pink → silver → green sheen for the "Filter" chip's border.
const FILTER_BORDER_GRADIENT = ['#E84CA9', '#C9CDD3', '#4CD37A'] as const;

export default function SearchScreen() {
  const { season: initialSeason, sort: initialSort } = useLocalSearchParams<{ season?: string; sort?: string }>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NearbyLocation[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();
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

  /*
   * Which search the results on screen belong to.
   *
   * Bumped whenever the filters change, and captured by loadMore so a page that
   * arrives after the user has changed the filters can be dropped rather than
   * appended. Comparing list lengths instead is not enough — a new search that
   * also returns a full page looks identical, and page two of the old search
   * would be spliced onto page one of the new one.
   */
  const searchGeneration = useRef(0);

  /*
   * How many rows are on screen, and which search produced them.
   *
   * Coming back from a location used to dump you at the top of page one. The
   * focus refresh below re-ran the query, the query always asked for one page,
   * and fifty rows replaced the four hundred someone had scrolled through — so
   * the list jumped to the start and the scrolling was wasted.
   *
   * Refreshing is still right (a location added since the app opened has to
   * appear), so instead of shrinking the list the refresh asks for as many rows
   * as are already shown. Same content, same length, same scroll position, just
   * up to date. Refs rather than state because the effect reads them: putting
   * results.length in its dependencies would make every appended page trigger
   * another fetch.
   */
  const loadedCount = useRef(0);
  const lastFilterKey = useRef<string | null>(null);
  const loadingMoreRef = useRef(false);

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
    searchGeneration.current += 1;
    const trimmed = query.trim();

    // A changed filter starts over at one page; anything else — coming back to
    // the tab, a location added elsewhere — keeps what is already on screen.
    const filterKey = JSON.stringify([trimmed, [...activeSlugs].sort(), sortBy, activeSeason]);
    const isRefresh = lastFilterKey.current === filterKey;
    lastFilterKey.current = filterKey;
    const wanted = isRefresh
      ? Math.min(Math.max(PAGE_SIZE, loadedCount.current), MAX_REFRESH_ROWS)
      : PAGE_SIZE;

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
        maxResults: wanted,
      })
        .then((result) => {
          if (cancelled) return;
          setResults(result);
          loadedCount.current = result.length;
          // total_count is on every row and identical across them; with no rows
          // there is nothing to read it from, and the answer is zero anyway.
          setTotalCount(result[0]?.total_count ?? 0);
        })
        .catch(() => {
          if (cancelled) return;
          setResults([]);
          loadedCount.current = 0;
          setTotalCount(0);
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
  const sortLabelKey = SORT_OPTIONS.find((o) => o.key === sortBy)?.labelKey ?? 'search.sortBy';
  const hasMore = results.length < totalCount;

  /*
   * The next fifty, appended.
   *
   * Guarded on loading as well as loadingMore: FlatList fires onEndReached
   * while the first page is still in flight (an empty list is scrolled to its
   * end by definition), which would fetch page two and prepend it to nothing.
   *
   * Paging by offset is only sound because migration 0088 gave the RPC a total
   * order. Before it the rating sort left every unrated row tied, and measured
   * against live data consecutive pages shared four rows while four others
   * became unreachable.
   *
   * The in-flight guard is a ref, not the loadingMore state. onEndReached fires
   * several times in the same frame as the list settles, and a state update is
   * not visible to the calls that follow it — so three of them all saw
   * loadingMore === false, all fetched offset 50, and the same fifty rows were
   * appended three times. A ref changes on the spot.
   */
  const loadMore = useCallback(() => {
    if (!coords || loading || loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const generation = searchGeneration.current;
    const trimmed = query.trim();
    fetchNearbyLocations(supabase, {
      lat: coords.latitude,
      lng: coords.longitude,
      radiusM: SEARCH_RADIUS_M,
      categorySlugs: activeSlugs,
      searchQuery: trimmed.length > 0 ? trimmed : null,
      sort: sortBy,
      season: activeSeason,
      maxResults: PAGE_SIZE,
      offset: results.length,
    })
      .then((next) => {
        // Belongs to a search the user has since moved on from.
        if (generation !== searchGeneration.current) return;
        setResults((current) => {
          const grown = [...current, ...next];
          loadedCount.current = grown.length;
          return grown;
        });
      })
      .catch(() => {
        // Leave what is already shown; the next scroll retries.
      })
      .finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
    // loadingMore is deliberately absent: the guard is loadingMoreRef, and
    // depending on the state as well would rebuild this callback on every page
    // for no benefit.
  }, [coords, loading, hasMore, query, activeSlugs, sortBy, activeSeason, results.length]);

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
          <Text style={styles.exploreTitle}>{t('search.title')}</Text>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-sharp" size={16} color={SearchPalette.textMuted} style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('search.placeholder')}
            placeholderTextColor={SearchPalette.textMuted}
            style={styles.searchInput}
          />
          {/* Only while there is something to clear — an X sitting over an
              empty field reads as a way to close the search, which it is not. */}
          {query.length > 0 && (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={10}
              accessibilityLabel={t('search.clear')}
              style={styles.searchClear}>
              <Ionicons name="close-circle" size={18} color={SearchPalette.textMuted} />
            </Pressable>
          )}
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
                  <Text style={styles.filterButtonText}>{t('search.filter')}</Text>
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
            <Text style={styles.resetFiltersX}>×</Text>
            <Text style={styles.resetFiltersText}>{t('search.resetFilters')}</Text>
          </Pressable>
        )}

        <View style={styles.metaRow}>
          {/* totalCount, not cards.length. The list holds one page; printing
              its length meant printing the page size — "100 RESULTS" whether
              there were a hundred or eight hundred. */}
          <Text style={styles.resultsCountText}>
            {loading ? t('search.searching') : t('search.results', { count: totalCount })}
          </Text>
          <Pressable style={styles.sortButton} onPress={() => setSortMenuVisible(true)}>
            <Text style={styles.sortButtonText}>{t(sortLabelKey).toUpperCase()}</Text>
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
            ListEmptyComponent={<Text style={styles.emptyText}>{t('search.noMatches')}</Text>}
            onEndReached={loadMore}
            // A screen and a half of runway. At 0.5 the fetch only started once
            // the last card was nearly in view, so every fifty rows ended in a
            // visible stall on a spinner; starting earlier means the next page
            // is usually there before you reach it.
            onEndReachedThreshold={1.5}
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator style={styles.footerLoader} color={SearchPalette.accent} />
              ) : hasMore ? null : cards.length > PAGE_SIZE ? (
                // Only worth saying once there was actually more than one page
                // to get through; on a short list it is noise.
                <Text style={styles.listEndText}>{t('search.thatsAll', { count: totalCount })}</Text>
              ) : null
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
            <Text style={styles.modalTitle}>{t('search.filterTitle')}</Text>

            <Text style={styles.modalSectionLabel}>{t('search.season')}</Text>
            <View style={styles.modalSeasonRow}>
              <Pressable
                style={[styles.modalSeasonChip, activeSeason === 'summer' && styles.modalSeasonChipActive]}
                onPress={() => setActiveSeason((current) => (current === 'summer' ? null : 'summer'))}>
                <Text
                  style={[styles.modalSeasonChipText, activeSeason === 'summer' && styles.modalSeasonChipTextActive]}>
                  ☀ {t('search.summer')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modalSeasonChip, activeSeason === 'winter' && styles.modalSeasonChipActive]}
                onPress={() => setActiveSeason((current) => (current === 'winter' ? null : 'winter'))}>
                <Text
                  style={[styles.modalSeasonChipText, activeSeason === 'winter' && styles.modalSeasonChipTextActive]}>
                  ❄ {t('search.winter')}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.modalSectionLabel}>{t('search.activities')}</Text>
            <View style={styles.categorySearchBar}>
              <Ionicons name="search-sharp" size={15} color={SearchPalette.textMuted} />
              <TextInput
                value={categoryQuery}
                onChangeText={setCategoryQuery}
                placeholder={t('search.searchActivities')}
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
                <Text style={styles.modalEmptyText}>{t('search.noActivitiesMatch')}</Text>
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
            <Text style={styles.modalTitle}>{t('search.sortBy')}</Text>
            {SORT_OPTIONS.map((option) => (
              <Pressable
                key={option.key}
                style={styles.modalRow}
                onPress={() => {
                  setSortBy(option.key);
                  setSortMenuVisible(false);
                }}>
                <Text style={styles.modalRowText}>{t(option.labelKey)}</Text>
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
  searchClear: {
    marginLeft: Spacing.two,
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
  /*
   * Built to the same pill as CategoryChip — height 34, radius 10, 1.5 border,
   * × then an uppercase label — so it sits in the same visual family as the
   * chips it clears rather than looking like a stray link under them.
   *
   * Red rather than a category colour: it undoes a selection, and it must not
   * be mistaken for one more filter to add.
   */
  resetFiltersButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginHorizontal: Spacing.three,
    // Clear of the filter row: at Spacing.one the two crowded each other and
    // read as a single control.
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    height: 34,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2564A',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  resetFiltersX: {
    fontFamily: MONO_FONT,
    fontSize: 13,
    fontWeight: '700',
    color: '#E2564A',
    includeFontPadding: false,
  },
  resetFiltersText: {
    fontFamily: MONO_FONT,
    fontSize: 12,
    letterSpacing: 0.3,
    color: '#E2564A',
    includeFontPadding: false,
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
  footerLoader: {
    marginVertical: Spacing.four,
  },
  listEndText: {
    textAlign: 'center',
    marginVertical: Spacing.four,
    fontFamily: MONO_FONT,
    fontSize: 11,
    letterSpacing: 0.5,
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
