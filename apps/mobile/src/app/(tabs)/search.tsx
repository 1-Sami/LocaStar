import { fetchCategories, fetchNearbyLocations, type Category, type NearbyLocation } from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryChip } from '@/components/category-chip';
import { categoryLabel } from '@/lib/categories';
import { LocationCard } from '@/components/location-card';
import { BottomTabInset, Fonts, MaxContentWidth, type SearchPaletteColors, Spacing } from '@/constants/theme';
import { useSearchPalette } from '@/hooks/use-search-palette';
import { useSaves } from '@/hooks/use-saves';
import { useUserLocation } from '@/hooks/use-user-location';
import { nearbyLocationToCard } from '@/lib/location-adapters';
import { supabase } from '@/lib/supabase';
import type { CardLocation } from '@/types/location';

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

/*
 * How far down the list the "back to top" arrow waits before appearing.
 *
 * About two screens of cards. Showing it any earlier puts it on top of the
 * first few results, which is the one moment nobody wants to leave.
 */
const SCROLL_TOP_AFTER_PX = 1200;

// Key and label kept apart: the key is compared and stored, the label is only
// ever displayed. Sharing one string between the two is what broke the Profile
// menu the moment it was translated.
const SORT_OPTIONS = [
  { key: 'distance', labelKey: 'search.sortDistance' },
  { key: 'rating', labelKey: 'search.sortRating' },
] as const;

export default function SearchScreen() {
  const {
    season: initialSeason,
    sort: initialSort,
    kind: initialKind,
  } = useLocalSearchParams<{ season?: string; sort?: string; kind?: string }>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NearbyLocation[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  /*
   * True from the first frame, because a search is always going to happen.
   *
   * It used to start false, and the effect below cannot run until the device
   * has a location — so between opening the tab and the fix landing, the screen
   * had no results, was not loading and had not failed. It rendered that as
   * "0 RESULTS" and "No matches.", which is a definite answer to a question
   * nobody had asked yet, and it was wrong: the search that eventually ran
   * found plenty. Empty is not a failure state, and it is not a waiting state
   * either.
   */
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // Separate from `loading` so the pull-down spinner is shown only for a pull.
  // Sharing the flag would have put it on screen for every filter change too.
  const [refreshing, setRefreshing] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const listRef = useRef<FlatList<CardLocation>>(null);
  // Mirrors showScrollTop for onScroll to compare against without re-rendering,
  // and is reset alongside it wherever the arrow is put away by hand.
  const scrollTopShown = useRef(false);
  const router = useRouter();
  const { t } = useTranslation();
  const { coords } = useUserLocation();
  const { favoriteIds, bucketListIds, toggleFavorite, toggleBucketList } = useSaves();
  const insets = useSafeAreaInsets();
  /* Rebuilt only when the theme changes, not on every render. */
  const palette = useSearchPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [activeSlugs, setActiveSlugs] = useState<string[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [sortBy, setSortBy] = useState<'distance' | 'rating'>(initialSort === 'rating' ? 'rating' : 'distance');
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [activeSeason, setActiveSeason] = useState<'summer' | 'winter' | null>(
    initialSeason === 'summer' || initialSeason === 'winter' ? initialSeason : null
  );
  const [activeKind, setActiveKind] = useState<'place' | 'activity' | null>(
    initialKind === 'activity' || initialKind === 'place' ? initialKind : null
  );
  // Free or paid, or no preference. Nothing links here carrying one, so unlike
  // season and kind it has no param to read.
  const [activePrice, setActivePrice] = useState<'free' | 'paid' | null>(null);
  // Results used to load once and never again, so a location added since the
  // app started never showed up. Bumping this on focus re-runs the query.
  const [refreshKey, setRefreshKey] = useState(0);

  /*
   * Home's "Show more" buttons arrive carrying filters, and this tab stays
   * mounted once it has been opened — NativeTabs does not tear its screens
   * down. Reading the params only into useState's initial value therefore
   * worked exactly once per app launch: press "Most liked" having already
   * visited Search, and the sort stayed where it was and nothing happened.
   * That was true of season and sort before this change too.
   *
   * Syncing during render rather than from an effect is deliberate — it is
   * React's sanctioned way to adjust state when an input changes, it lands
   * before the paint instead of causing a second one, and it does not trip the
   * cascading-render rule that setting state inside an effect does.
   *
   * Only *incoming* filters are applied. Arriving with no params at all — which
   * is what tapping the tab itself does — must leave the filters alone, or
   * every trip to another tab and back would silently wipe what the person had
   * chosen by hand.
   */
  const paramSignature = `${initialSort ?? ''}|${initialSeason ?? ''}|${initialKind ?? ''}`;
  const [appliedParams, setAppliedParams] = useState(paramSignature);
  if (paramSignature !== '||' && paramSignature !== appliedParams) {
    setAppliedParams(paramSignature);
    setSortBy(initialSort === 'rating' ? 'rating' : 'distance');
    setActiveSeason(initialSeason === 'summer' || initialSeason === 'winter' ? initialSeason : null);
    setActiveKind(initialKind === 'activity' || initialKind === 'place' ? initialKind : null);
  }

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
   * What the badge on the filter button counts.
   *
   * Everything the sheet can set, not just the categories: the sheet is now the
   * only way to reach kind, season and price, so a badge that ignored them
   * would say "none" while three filters were quietly on.
   */
  const activeFilterCount =
    activeSlugs.length + (activeKind ? 1 : 0) + (activeSeason ? 1 : 0) + (activePrice ? 1 : 0);

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
  const [searchFailed, setSearchFailed] = useState(false);
  const lastFilterKey = useRef<string | null>(null);
  const loadingMoreRef = useRef(false);
  // What was in the search box last time the query ran, so the effect can tell
  // typing (which is worth waiting out) from every other reason it re-runs.
  // Seeded with the empty box the screen actually opens with, so the first
  // search — which nobody typed — is not made to wait for a keystroke.
  const lastQueryText = useRef('');

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((key) => key + 1);
    }, [])
  );

  useEffect(() => {
    fetchCategories(supabase)
      .then(setCategories)
      .catch((err) => {
        // Losing the chips degrades filtering rather than the results, so this
        // does not take over the screen — but it must not vanish either.
        console.error('Failed to load categories', err);
        setCategories([]);
      });
  }, []);

  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    searchGeneration.current += 1;
    const trimmed = query.trim();

    // A changed filter starts over at one page; anything else — coming back to
    // the tab, a location added elsewhere — keeps what is already on screen.
    const filterKey = JSON.stringify([trimmed, [...activeSlugs].sort(), sortBy, activeSeason, activeKind, activePrice]);
    const isRefresh = lastFilterKey.current === filterKey;
    lastFilterKey.current = filterKey;
    const wanted = isRefresh
      ? Math.min(Math.max(PAGE_SIZE, loadedCount.current), MAX_REFRESH_ROWS)
      : PAGE_SIZE;

    /*
     * The wait is for typing, and only for typing.
     *
     * It exists so that a word does not become one request per letter. Tapping
     * a category, changing the sort, or coming back to the tab each happen once
     * and are already the user's final answer, so making them wait 300ms was
     * latency bought for nothing. Still a timeout at zero rather than a direct
     * call, so the cleanup below can cancel it either way.
     */
    const debounced = lastQueryText.current !== trimmed;
    lastQueryText.current = trimmed;

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
        price: activePrice,
        kind: activeKind,
        maxResults: wanted,
      })
        .then((result) => {
          if (cancelled) return;
          setResults(result);
          setSearchFailed(false);
          loadedCount.current = result.length;
          // total_count is on every row and identical across them; with no rows
          // there is nothing to read it from, and the answer is zero anyway.
          setTotalCount(result[0]?.total_count ?? 0);

          /*
           * A different search is a different list, so it starts at its own top
           * rather than wherever the last one had been scrolled to. A refresh is
           * the opposite case and is left alone deliberately — the whole point
           * of it is that the position survives.
           *
           * The arrow has to be put away by hand here. It is driven by onScroll,
           * and a list that jumps to the top because its data was replaced does
           * not necessarily emit one — which left it hovering over the first
           * card, offering to take you where you already were.
           */
          if (!isRefresh) {
            scrollTopShown.current = false;
            setShowScrollTop(false);
            listRef.current?.scrollToOffset({ offset: 0, animated: false });
          }
        })
        .catch((err) => {
          // "Nothing matched your search" is a statement about the search, and
          // a failed request has not made one.
          console.error('Search failed', err);
          if (cancelled) return;
          setResults([]);
          loadedCount.current = 0;
          setTotalCount(0);
          setSearchFailed(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
          // Not guarded on `cancelled`: if this request was superseded, the one
          // that replaced it is not the pull, and leaving the flag set would
          // strand the spinner at the top of the list with nothing behind it.
          setRefreshing(false);
        });
    }, debounced ? 300 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [coords, query, activeSlugs, sortBy, activeSeason, activeKind, activePrice, refreshKey]);

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
      price: activePrice,
      kind: activeKind,
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
  }, [coords, loading, hasMore, query, activeSlugs, sortBy, activeSeason, activeKind, activePrice, results.length]);

  /*
   * Drag down from the top to ask the database again.
   *
   * The same path the tab already takes when you come back to it — bump
   * refreshKey and the effect re-runs, asking for as many rows as are on screen
   * rather than the first page, so the list keeps its length and its position.
   * The spinner is cleared where the request settles.
   */
  const onPullToRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((key) => key + 1);
  }, []);

  /*
   * onScroll runs on every frame of a drag, so this compares against a ref and
   * only touches state when the answer actually changes. Setting it each time
   * would re-render the whole list sixty times a second to keep telling it the
   * same thing.
   */
  const onListScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const past = event.nativeEvent.contentOffset.y > SCROLL_TOP_AFTER_PX;
    if (past === scrollTopShown.current) return;
    scrollTopShown.current = past;
    setShowScrollTop(past);
  }, []);

  const trimmedCategoryQuery = categoryQuery.trim().toLowerCase();
  const visibleCategories = trimmedCategoryQuery
    ? categories.filter((c) =>
        categoryLabel(t, c.slug, c.name).toLowerCase().includes(trimmedCategoryQuery)
      )
    : categories;

  // Reset the search each time the picker closes so it reopens showing everything.
  const closePicker = () => {
    setPickerVisible(false);
    setCategoryQuery('');
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.searchBar}>
          <Ionicons name="search-sharp" size={16} color={palette.textMuted} style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('search.placeholder')}
            placeholderTextColor={palette.textMuted}
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
              <Ionicons name="close-circle" size={18} color={palette.textMuted} />
            </Pressable>
          )}

          {/* Inside the field, behind a divider, rather than a pill of its own
              below it: it belongs to the search the way the sort control
              belongs to the results. The badge is what tells you filters are on
              now that the word FILTER is gone. */}
          <View style={styles.searchBarDivider} />
          <Pressable
            onPress={() => setPickerVisible(true)}
            hitSlop={8}
            accessibilityLabel={t('search.filter')}
            style={styles.searchFilterButton}>
            <Ionicons name="options-sharp" size={18} color={palette.text} />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Only when there is something in it. The row used to be held open by
            the FILTER button living in it; with that moved into the field
            above, an empty row is 44px of nothing above the results. */}
        {activeSlugs.length > 0 && (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterRow}
            contentContainerStyle={styles.filterRowContent}
            data={categories.filter((c) => activeSlugs.includes(c.slug))}
            keyExtractor={(item) => item.slug}
            renderItem={({ item }) => (
              <CategoryChip
                label={categoryLabel(t, item.slug, item.name)}
                categorySlug={item.slug}
                onRemove={() => setActiveSlugs((current) => current.filter((s) => s !== item.slug))}
              />
            )}
          />
        )}

        {/*
          Typed text counts as something to clear, and clearing empties the box
          along with the chips. It is the one control that says "start over", so
          leaving the search term behind would have been a half-answer — and the
          term is usually the narrower filter of the two.
        */}
        {(query.length > 0 || activeFilterCount > 0) && (
          <Pressable
            style={styles.resetFiltersButton}
            hitSlop={8}
            onPress={() => {
              setQuery('');
              setActiveSlugs([]);
              setActiveSeason(null);
              setActiveKind(null);
              setActivePrice(null);
            }}>
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
            <Ionicons name="swap-vertical-sharp" size={14} color={palette.text} />
          </Pressable>
        </View>

        {/*
          Only take the list away for the very first load. Swapping it for a
          spinner on every refresh unmounts it, which throws away how far the
          person had scrolled — so coming back from a location started at the
          top again.
        */}
        {loading && cards.length === 0 ? (
          <ActivityIndicator style={styles.loadingIndicator} color={palette.accent} />
        ) : (
          <FlatList
            ref={listRef}
            data={cards}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            onScroll={onListScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onPullToRefresh}
                // Both are needed: iOS draws the spinner in tintColor, Android
                // in colors, and the default is a dark grey that disappears on
                // the dark theme.
                tintColor={palette.accent}
                colors={[palette.accent]}
                progressBackgroundColor={palette.card}
              />
            }
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {searchFailed ? t('common.somethingWentWrong') : t('search.noMatches')}
              </Text>
            }
            onEndReached={loadMore}
            // A screen and a half of runway. At 0.5 the fetch only started once
            // the last card was nearly in view, so every fifty rows ended in a
            // visible stall on a spinner; starting earlier means the next page
            // is usually there before you reach it.
            onEndReachedThreshold={1.5}
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator style={styles.footerLoader} color={palette.accent} />
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

        {/*
          Outside the list rather than in it, so it stays put while the cards
          move under it. Last in the tree so it draws over them.
        */}
        {showScrollTop && (
          <Pressable
            style={styles.scrollTopButton}
            accessibilityLabel={t('search.backToTop')}
            accessibilityRole="button"
            onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}>
            <Ionicons name="arrow-up" size={20} color={palette.text} />
          </Pressable>
        )}
      </SafeAreaView>


      <Modal visible={pickerVisible} animationType="slide" transparent onRequestClose={closePicker}>
        {/* The sheet is anchored to the bottom, so the keyboard opened straight
            over the activity search box you were typing into. A Modal is its own
            window on Android and does not inherit the activity's adjustResize,
            so this has to be handled here rather than in app.json. */}
        <KeyboardAvoidingView
          style={[styles.modalBackdrop, { paddingBottom: insets.bottom }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {/* Backdrop as a sibling rather than a wrapper: wrapping the sheet in
              a Pressable would make every tap inside it dismiss the sheet. */}
          <Pressable style={StyleSheet.absoluteFill} onPress={closePicker} />
          <Pressable style={styles.modalContent} onPress={() => {}}>
            {/* No title: the sheet only ever opens from the filter button, so
                the word "Filter" was a heading that said what the tap already
                said. Three columns rather than three stacked rows — six chips
                in pairs fit across a phone, and the sheet opens over a keyboard
                often enough that the height saved is worth having.

                Show first because it is the broadest cut, and shown at all so
                that arriving here from Home's "Show more" is something you can
                see and undo. The chips carry an icon each: the section below is
                headed ACTIVITIES too, but means categories — a collision worth
                not deepening with two bare words that look alike. */}
            <View style={styles.modalFilterGroups}>
              <View style={styles.modalFilterGroup}>
                <Text style={styles.modalSectionLabel}>{t('search.show')}</Text>
                <Pressable
                  style={[styles.modalFilterChip, activeKind === 'activity' && styles.modalSeasonChipActive]}
                  onPress={() => setActiveKind((current) => (current === 'activity' ? null : 'activity'))}>
                  <Text
                    style={[styles.modalSeasonChipText, activeKind === 'activity' && styles.modalSeasonChipTextActive]}>
                    📅 {t('search.onlyActivities')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.modalFilterChip, activeKind === 'place' && styles.modalSeasonChipActive]}
                  onPress={() => setActiveKind((current) => (current === 'place' ? null : 'place'))}>
                  <Text
                    style={[styles.modalSeasonChipText, activeKind === 'place' && styles.modalSeasonChipTextActive]}>
                    📍 {t('search.onlyPlaces')}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.modalFilterGroup}>
                <Text style={styles.modalSectionLabel}>{t('search.season')}</Text>
                <Pressable
                  style={[styles.modalFilterChip, activeSeason === 'summer' && styles.modalSeasonChipActive]}
                  onPress={() => setActiveSeason((current) => (current === 'summer' ? null : 'summer'))}>
                  <Text
                    style={[styles.modalSeasonChipText, activeSeason === 'summer' && styles.modalSeasonChipTextActive]}>
                    ☀ {t('search.summer')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.modalFilterChip, activeSeason === 'winter' && styles.modalSeasonChipActive]}
                  onPress={() => setActiveSeason((current) => (current === 'winter' ? null : 'winter'))}>
                  <Text
                    style={[styles.modalSeasonChipText, activeSeason === 'winter' && styles.modalSeasonChipTextActive]}>
                    ❄ {t('search.winter')}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.modalFilterGroup}>
                <Text style={styles.modalSectionLabel}>{t('search.type')}</Text>
                <Pressable
                  style={[styles.modalFilterChip, activePrice === 'free' && styles.modalSeasonChipActive]}
                  onPress={() => setActivePrice((current) => (current === 'free' ? null : 'free'))}>
                  <Text
                    style={[styles.modalSeasonChipText, activePrice === 'free' && styles.modalSeasonChipTextActive]}>
                    {t('search.free')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.modalFilterChip, activePrice === 'paid' && styles.modalSeasonChipActive]}
                  onPress={() => setActivePrice((current) => (current === 'paid' ? null : 'paid'))}>
                  <Text
                    style={[styles.modalSeasonChipText, activePrice === 'paid' && styles.modalSeasonChipTextActive]}>
                    {t('search.paid')}
                  </Text>
                </Pressable>
              </View>
            </View>

            <Text style={styles.modalSectionLabel}>{t('search.categories')}</Text>
            <View style={styles.categorySearchBar}>
              <Ionicons name="search-sharp" size={15} color={palette.textMuted} />
              <TextInput
                value={categoryQuery}
                onChangeText={setCategoryQuery}
                placeholder={t('search.searchCategories')}
                placeholderTextColor={palette.textMuted}
                style={styles.categorySearchInput}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {categoryQuery.length > 0 && (
                <Pressable onPress={() => setCategoryQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={palette.textMuted} />
                </Pressable>
              )}
            </View>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              {visibleCategories.length === 0 ? (
                <Text style={styles.modalEmptyText}>{t('search.noCategoriesMatch')}</Text>
              ) : (
                visibleCategories.map((category) => {
                  const active = activeSlugs.includes(category.slug);
                  return (
                    <Pressable
                      key={category.slug}
                      style={[styles.modalRow, active && styles.modalRowActive]}
                      onPress={() =>
                        setActiveSlugs((current) =>
                          active ? current.filter((s) => s !== category.slug) : [...current, category.slug]
                        )
                      }>
                      <Text style={[styles.modalRowText, active && styles.modalRowTextActive]}>
                        {categoryLabel(t, category.slug, category.name)}
                      </Text>
                      {active && <Ionicons name="checkmark" size={18} color={palette.accent} />}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={sortMenuVisible} animationType="slide" transparent onRequestClose={() => setSortMenuVisible(false)}>
        <Pressable
          style={[styles.modalBackdrop, { paddingBottom: insets.bottom }]}
          onPress={() => setSortMenuVisible(false)}>
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
                {sortBy === option.key && <Ionicons name="checkmark" size={18} color={palette.accent} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const MONO_FONT = Fonts.mono;

const createStyles = (c: SearchPaletteColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  // Plain text on the page background — no pill or panel behind the title.
  searchBar: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.inputBorder,
    backgroundColor: c.card,
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
    color: c.text,
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
  /* A hairline between the text and the button, so the field reads as a box
     with a control at its end rather than an icon floating in the input. */
  searchBarDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: Spacing.two,
    marginLeft: Spacing.two,
    backgroundColor: c.inputBorder,
  },
  searchFilterButton: {
    paddingLeft: Spacing.two,
    justifyContent: 'center',
  },
  /* Sits over the icon's top-right corner. Negative offsets rather than a
     bigger button: the button is already a 44pt target with its hitSlop, and
     growing it would push the text field in. */
  filterBadge: {
    position: 'absolute',
    top: -6,
    right: -7,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CD37A',
  },
  filterBadgeText: {
    fontFamily: MONO_FONT,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    color: '#0A0A0A',
    includeFontPadding: false,
  },
  /*
   * Plain red text, the owner's call: as a bordered pill it was the loudest
   * thing on the screen and looked like one more filter to add rather than the
   * way to undo them. Red because it undoes, underlined because with no box
   * around it nothing else says it can be tapped.
   */
  resetFiltersButton: {
    alignSelf: 'flex-start',
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
  },
  resetFiltersText: {
    fontFamily: MONO_FONT,
    fontSize: 11,
    letterSpacing: 0.3,
    color: '#E2564A',
    textDecorationLine: 'underline',
    includeFontPadding: false,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    marginTop: Spacing.two,
  },
  resultsCountText: {
    fontFamily: MONO_FONT,
    fontSize: 12,
    letterSpacing: 0.5,
    color: c.textMuted,
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
    color: c.text,
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
  /*
   * Clear of the tab bar, on the side the thumb is already on. 44 square is the
   * smallest target both platforms call reliable, and it is round so it does
   * not read as one more card.
   */
  scrollTopButton: {
    position: 'absolute',
    right: Spacing.three,
    bottom: BottomTabInset + Spacing.two,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.hairline,
    // It floats over cards painted the same colour it is, so without a shadow
    // it reads as one of them that has come loose.
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  emptyText: {
    textAlign: 'center',
    marginTop: Spacing.six,
    color: c.textMuted,
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
    color: c.textMuted,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    maxHeight: '70%',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
    backgroundColor: c.card,
  },
  modalTitle: {
    fontFamily: MONO_FONT,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: c.text,
    marginBottom: Spacing.two,
  },
  modalSectionLabel: {
    fontFamily: MONO_FONT,
    fontSize: 12,
    letterSpacing: 0.5,
    color: c.textMuted,
  },
  modalFilterGroups: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  modalFilterGroup: {
    flex: 1,
    gap: Spacing.two,
  },
  /* Fills its column rather than hugging its label: three columns of pills that
     each sized themselves to their own word left the sheet looking ragged, and
     the shorter labels ("Free") gave a smaller target than the longer ones. */
  modalFilterChip: {
    borderWidth: 1,
    borderColor: c.inputBorder,
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  modalSeasonChipActive: {
    backgroundColor: c.accent,
    borderColor: c.accent,
  },
  /* 13, not the default 14: three columns across a phone leave about 96px of
     text per chip, and Swedish "📅 Evenemang" is the longest label there is.
     Centred because the chips fill their column. */
  modalSeasonChipText: {
    fontSize: 13,
    textAlign: 'center',
    color: c.text,
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
    borderColor: c.inputBorder,
    backgroundColor: c.background,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.one,
  },
  categorySearchInput: {
    flex: 1,
    fontSize: 15,
    color: c.text,
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalEmptyText: {
    color: c.textMuted,
    paddingVertical: Spacing.three,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.hairline,
  },
  /*
   * A selected row is the whole row, not a tick.
   *
   * The checkmark sat at the right edge, which is exactly where the thumb is
   * when you tap — so you could not see what you had just selected without
   * moving your hand. The tick stays, but the row now carries the state on its
   * own: tinted background, accent left edge, brighter bolder label.
   */
  modalRowActive: {
    backgroundColor: 'rgba(76,211,122,0.14)',
    borderLeftWidth: 3,
    borderLeftColor: c.accent,
    borderBottomColor: 'transparent',
  },
  modalRowTextActive: {
    color: c.accent,
    fontWeight: '700',
  },
  modalRowText: {
    color: c.text,
    fontSize: 16,
  },
});
