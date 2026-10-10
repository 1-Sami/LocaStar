import {
  deleteListShare,
  stopSharingList,
  deleteShare,
  fetchMyListShares,
  fetchMyShares,
  fetchSavedLists,
  fetchSavedLocations,
  setListLiked,
  type LocationShare,
  type PublicList,
  type SharedList,
} from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListCard } from '@/components/list-card';
import { OfflineNotice } from '@/components/offline-notice';
import { SavedCard } from '@/components/saved-card';
import { SectionBadge } from '@/components/section-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSaves } from '@/hooks/use-saves';
import { SAVED_CACHE, readCache, writeCache } from '@/lib/offline-cache';
import { withTimeout } from '@/lib/with-timeout';
import { useAuth } from '@/lib/auth-context';
import { useBlockedUsers } from '@/lib/blocked-users-context';
import { confirmAsync } from '@/lib/confirm';
import { savedLocationToCard } from '@/lib/location-adapters';
import { supabase } from '@/lib/supabase';
import type { CardLocation } from '@/types/location';

function FullSection({
  title,
  badgeColor,
  items,
  favoriteIds,
  bucketListIds,
  onToggleFavorite,
  onToggleBucketList,
  onOpen,
  onLayout,
  noteForItem,
  onDeleteItem,
  emptyMessage,
}: {
  title: string;
  badgeColor: string;
  items: CardLocation[];
  favoriteIds: Set<string>;
  bucketListIds: Set<string>;
  onToggleFavorite: (id: string) => void;
  onToggleBucketList: (id: string) => void;
  onOpen: (id: string) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  noteForItem?: (item: CardLocation, index: number) => string | null;
  onDeleteItem?: (item: CardLocation, index: number) => void;
  emptyMessage: string;
}) {
  return (
    <View style={styles.section} onLayout={onLayout}>
      <SectionBadge label={title} count={items.length} backgroundColor={badgeColor} />
      {items.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.sectionEmptyText}>
          {emptyMessage}
        </ThemedText>
      ) : (
        <View style={styles.favoritesGrid}>
          {items.map((item, index) => {
            const note = noteForItem?.(item, index);
            return (
              <View key={`${item.id}-${index}`} style={styles.gridSlot}>
                {(note || onDeleteItem) && (
                  <View style={styles.noteRow}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.shareNote}>
                      {note}
                    </ThemedText>
                    {onDeleteItem && (
                      <Pressable onPress={() => onDeleteItem(item, index)} hitSlop={8}>
                        <Ionicons name="close-circle" size={18} color="#E05252" />
                      </Pressable>
                    )}
                  </View>
                )}
                <SavedCard
                  location={item}
                  isFavorite={favoriteIds.has(item.id)}
                  isBucketListed={bucketListIds.has(item.id)}
                  onToggleFavorite={() => onToggleFavorite(item.id)}
                  onToggleBucketList={() => onToggleBucketList(item.id)}
                  onPress={() => onOpen(item.id)}
                />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function FavoritesSection({
  items,
  favoriteIds,
  bucketListIds,
  onToggleFavorite,
  onToggleBucketList,
  onOpen,
  onLayout,
}: {
  items: CardLocation[];
  favoriteIds: Set<string>;
  bucketListIds: Set<string>;
  onToggleFavorite: (id: string) => void;
  onToggleBucketList: (id: string) => void;
  onOpen: (id: string) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.section} onLayout={onLayout}>
      <SectionBadge label={t('saved.favorites')} count={items.length} backgroundColor="#E8A93B" textColor="#1A1400" />
      {items.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.sectionEmptyText}>
          {t('saved.favoritesEmpty')}
        </ThemedText>
      ) : (
        <View style={styles.favoritesGrid}>
          {items.map((item) => (
            /* gridSlot, like every other section. Without it the card had no
               width of its own, so a space-between row sized each one to its
               contents: Favourites came out wider than the grid below it, its
               two cards different widths from each other, and neither lining
               up with anything. */
            <View key={item.id} style={styles.gridSlot}>
              <SavedCard
                location={item}
                isFavorite={favoriteIds.has(item.id)}
                isBucketListed={bucketListIds.has(item.id)}
                onToggleFavorite={() => onToggleFavorite(item.id)}
                onToggleBucketList={() => onToggleBucketList(item.id)}
                onPress={() => onOpen(item.id)}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * The whole screen, as it is written to and read from the device.
 *
 * Plain data only — what the five sections render, nothing derived and nothing
 * about where the person was standing. See lib/offline-cache: places may be
 * cached, positions never.
 */
type SavedScreen = {
  favorites: CardLocation[];
  bucketList: CardLocation[];
  shares: LocationShare[];
  sharedLists: SharedList[];
  savedLists: PublicList[];
};

export default function FavoritesScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const router = useRouter();
  const { section: sectionParam } = useLocalSearchParams<{ section?: string }>();
  const { favoriteIds, bucketListIds, toggleFavorite, toggleBucketList } = useSaves();

  const [favorites, setFavorites] = useState<CardLocation[]>([]);
  const [bucketList, setBucketList] = useState<CardLocation[]>([]);
  const [shares, setShares] = useState<LocationShare[]>([]);
  const [sharedLists, setSharedLists] = useState<SharedList[]>([]);
  const [savedLists, setSavedLists] = useState<PublicList[]>([]);
  const { isBlocked } = useBlockedUsers();
  // You can save a list and block its owner afterwards. Without this it would
  // sit on your own Saved shelf, which is the last place a block should leave
  // somebody visible.
  const visibleSavedLists = savedLists.filter((list) => !isBlocked(list.ownerId));
  const [loading, setLoading] = useState(true);
  /** Set only by a load that worked, so a first load that failed is not "empty". */
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  /** When the copy on screen was saved, or null while it is live. */
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  /**
   * Whether anything is on screen yet, cached or fresh.
   *
   * A ref, not state: reload reads it and would otherwise have to list it as a
   * dependency, which would rebuild the callback and re-fire the focus effect
   * every time it flipped.
   */
  const painted = useRef(false);
  const theme = useTheme();

  /*
   * One place that fills the five sections, so the live path and the cached
   * path cannot drift into setting different subsets of the screen.
   */
  const applySaved = useCallback((next: SavedScreen) => {
    setFavorites(next.favorites);
    setBucketList(next.bucketList);
    setShares(next.shares);
    setSharedLists(next.sharedLists);
    setSavedLists(next.savedLists);
  }, []);

  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Partial<Record<string, number>>>({});

  const scrollToSection = useCallback(
    (key: string) => {
      const y = sectionOffsets.current[key];
      if (y !== undefined) {
        scrollRef.current?.scrollTo({ y: Math.max(y - Spacing.three, 0), animated: true });
      }
    },
    []
  );

  const handleToggleSavedListLike = (list: PublicList) => {
    if (!session) return;
    const nextLiked = !list.likedByMe;
    setSavedLists((current) =>
      current.map((item) =>
        item.id === list.id
          ? { ...item, likedByMe: nextLiked, likeCount: item.likeCount + (nextLiked ? 1 : -1) }
          : item
      )
    );
    setListLiked(supabase, list.id, session.user.id, nextLiked).catch(() => reload());
  };

  const handleSectionLayout = useCallback(
    (key: string) => (event: LayoutChangeEvent) => {
      sectionOffsets.current[key] = event.nativeEvent.layout.y;
      if (sectionParam === key) scrollToSection(key);
    },
    [sectionParam, scrollToSection]
  );

  const reload = useCallback(async () => {
    if (!session) return;
    setLoadFailed(false);

    /*
     * The saved copy goes up before the network is touched.
     *
     * Reading it only in the catch — which is what this did first — meant
     * waiting for an offline request to give up before anything appeared, and
     * nothing here times out, so on a phone with no signal that is tens of
     * seconds of empty screen. Offline this paint is the whole screen; online
     * it is the few hundred milliseconds before fresh rows replace it.
     */
    if (!painted.current) {
      setLoading(true);
      const saved = await readCache<SavedScreen>(SAVED_CACHE, session.user.id);
      if (saved) {
        applySaved(saved.data);
        setCachedAt(saved.savedAt);
        setHasLoadedOnce(true);
        setLoading(false);
        painted.current = true;
      }
    }

    try {
      const [favoriteRows, bucketListRows, shareRows, sharedListRows, savedListRows] = await withTimeout(
        Promise.all([
          fetchSavedLocations(supabase, session.user.id, 'favorite'),
          fetchSavedLocations(supabase, session.user.id, 'bucket_list'),
          fetchMyShares(supabase, session.user.id),
          fetchMyListShares(supabase, session.user.id),
          fetchSavedLists(supabase, session.user.id),
        ])
      );
      const next = {
        favorites: favoriteRows.map(savedLocationToCard),
        bucketList: bucketListRows.map(savedLocationToCard),
        shares: shareRows,
        sharedLists: sharedListRows,
        savedLists: savedListRows,
      };
      applySaved(next);
      setHasLoadedOnce(true);
      setCachedAt(null);
      painted.current = true;
      /*
       * All five sections, not only the two that matter offline.
       *
       * Caching favourites alone would leave the other three rendering their
       * "nothing here yet" copy from a cache that simply does not hold them —
       * the same lie the catch below exists to avoid, arriving by a tidier
       * route. They are all this person's own screen, and together they are
       * tens of kilobytes.
       */
      void writeCache(SAVED_CACHE, session.user.id, next);
    } catch (err) {
      /*
       * Five sections of somebody's own saved places, and every one of them has
       * an empty message written as a statement about them — "Nothing saved yet
       * — tap the heart on a location". Rendering that because a request failed
       * tells them their saves are gone.
       *
       * The saved copy is already on screen by now if there was one — see the
       * paint above — so this only has to decide what to do when there was
       * not. The failure state is for that case alone; otherwise the cached
       * rows stand, with the bar above them saying when they were last true.
       */
      console.error('Failed to load saved places', err);
      if (!painted.current) setLoadFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session, applySaved]);

  /*
   * The spinner is cleared where the request settles, in reload's finally —
   * clearing it here would stop it a frame after it started.
   */
  const onPullToRefresh = useCallback(() => {
    setRefreshing(true);
    reload().catch((err) => console.error('Reload failed', err));
  }, [reload]);

  // On focus rather than on mount: saving or sharing something from another
  // screen used to leave this list stale until the app was restarted.
  useFocusEffect(
    useCallback(() => {
      reload().catch((err) => console.error('Reload failed', err));
    }, [reload])
  );

  const handleToggleFavorite = async (id: string) => {
    await toggleFavorite(id);
    reload().catch((err) => console.error('Reload failed', err));
  };
  const handleToggleBucketList = async (id: string) => {
    await toggleBucketList(id);
    reload().catch((err) => console.error('Reload failed', err));
  };
  const handleOpen = (id: string) => router.push({ pathname: '/location/[id]', params: { id } });

  const handleDeleteShare = async (index: number) => {
    const share = shares[index];
    if (!share) return;
    const confirmed = await confirmAsync(
      t('saved.removeShareTitle'),
      t('saved.removeShareBody'),
      t('common.remove')
    );
    if (!confirmed) return;
    setShares((current) => current.filter((_item, i) => i !== index));
    deleteShare(supabase, share.shareId).catch(() => reload());
  };

  const handleOpenSharedList = (list: SharedList) =>
    router.push({ pathname: '/lists/[id]', params: { id: list.id, name: list.name, shared: '1' } });

  const handleDeleteSharedList = async (list: SharedList) => {
    const otherParty = list.otherPartyUsername ?? list.otherPartyDisplayName ?? t('saved.themPlaceholder');
    // A sent card stands for every recipient, so say how many lose access and
    // revoke all of them — pulling a single share would leave the others able
    // to see a list that has disappeared from this screen.
    const audience =
      list.recipientCount > 1
        ? t('saved.peopleCount', { count: list.recipientCount })
        : otherParty;
    const confirmed = await confirmAsync(
      list.direction === 'sent' ? t('saved.stopSharingListTitle') : t('saved.removeSharedListTitle'),
      list.direction === 'sent'
        ? t('saved.stopSharingListBody', { audience, name: list.name })
        : t('saved.removeSharedListBody'),
      list.direction === 'sent' ? t('saved.stopSharing') : t('common.remove')
    );
    if (!confirmed) return;
    setSharedLists((current) => current.filter((l) => l.shareId !== list.shareId));

    const request =
      list.direction === 'sent' && session
        ? stopSharingList(supabase, list.id, session.user.id)
        : deleteListShare(supabase, list.shareId);
    request.catch(() => reload());
  };

  if (!session) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <View style={styles.loggedOutPrompt}>
            <ThemedText type="default" themeColor="textSecondary" style={styles.centerText}>
              {t('saved.loggedOut')}
            </ThemedText>
            <Pressable style={styles.primaryButton} onPress={() => router.push('/sign-in')}>
              <ThemedText type="smallBold" style={styles.primaryButtonText}>
                {t('common.logIn')}
              </ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const sharedCards = shares.map(savedLocationToCard);
  const sharedNote = (_item: CardLocation, index: number) => {
    const share = shares[index];
    if (!share) return null;
    const name = share.otherPartyUsername ?? share.otherPartyDisplayName;
    if (!name) return null;
    return share.direction === 'sent' ? `Shared with ${name}` : `Shared by ${name}`;
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        {/*
          Only for the first load. Swapping the content for a spinner on every
          focus unmounts the list and throws away the scroll position — the
          same bug that had to be fixed on Search.
        */}
        {loading && !hasLoadedOnce ? (
          <ActivityIndicator style={styles.loadingIndicator} />
        ) : loadFailed && !hasLoadedOnce ? (
          /* Only when there is nothing to show. Once a load has worked, a later
             refresh failing leaves the places on screen rather than replacing
             five sections of them with one line of apology. */
          <ThemedText type="default" themeColor="textSecondary" style={styles.sectionEmptyText}>
            {t('common.somethingWentWrong')}
          </ThemedText>
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onPullToRefresh}
                // Both are needed: iOS draws the spinner in tintColor, Android
                // in colors, and the default is a dark grey that disappears on
                // the dark theme.
                tintColor={theme.primary}
                colors={[theme.primary]}
                progressBackgroundColor={theme.backgroundElement}
              />
            }
          >
            {cachedAt && <OfflineNotice savedAt={cachedAt} />}
            <FavoritesSection
              items={favorites}
              favoriteIds={favoriteIds}
              bucketListIds={bucketListIds}
              onToggleFavorite={handleToggleFavorite}
              onToggleBucketList={handleToggleBucketList}
              onOpen={handleOpen}
              onLayout={handleSectionLayout('favorites')}
            />
            <FullSection
              title={t('saved.bucketList')}
              badgeColor="#4C8FE8"
              items={bucketList}
              favoriteIds={favoriteIds}
              bucketListIds={bucketListIds}
              onToggleFavorite={handleToggleFavorite}
              onToggleBucketList={handleToggleBucketList}
              onOpen={handleOpen}
              onLayout={handleSectionLayout('bucketList')}
              emptyMessage={t('saved.bucketListEmpty')}
            />

            {visibleSavedLists.length > 0 && (
              <View style={styles.section} onLayout={handleSectionLayout('savedLists')}>
                <SectionBadge label={t('saved.savedLists')} count={visibleSavedLists.length} backgroundColor="#2BA3A3" />
                <View style={styles.savedListsGrid}>
                  {visibleSavedLists.map((list) => (
                    <View key={list.id} style={styles.savedListSlot}>
                      <ListCard
                        list={list}
                        ownerUsername={list.ownerUsername ?? list.ownerDisplayName ?? 'someone'}
                        onToggleLike={() => handleToggleSavedListLike(list)}
                        onPress={() =>
                          router.push({
                            pathname: '/lists/[id]',
                            params: { id: list.id, name: list.name, isPublic: '1', shared: '1' },
                          })
                        }
                      />
                    </View>
                  ))}
                </View>
              </View>
            )}
            <View style={styles.section} onLayout={handleSectionLayout('shared')}>
              <SectionBadge label={t('saved.shared')} count={sharedCards.length + sharedLists.length} backgroundColor="#B0B4BA" />
              {sharedCards.length === 0 && sharedLists.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.sectionEmptyText}>
                  {t('saved.sharedEmpty')}
                </ThemedText>
              ) : (
                <View style={styles.sectionList}>
                  {sharedCards.map((item, index) => {
                    const note = sharedNote(item, index);
                    return (
                      <View key={`${item.id}-${index}`} style={styles.gridSlot}>
                        <View style={styles.noteRow}>
                          <ThemedText type="small" themeColor="textSecondary" style={styles.shareNote}>
                            {note}
                          </ThemedText>
                          <Pressable onPress={() => handleDeleteShare(index)} hitSlop={8}>
                            <Ionicons name="close-circle" size={18} color="#E05252" />
                          </Pressable>
                        </View>
                        <SavedCard
                          location={item}
                          isFavorite={favoriteIds.has(item.id)}
                          isBucketListed={bucketListIds.has(item.id)}
                          onToggleFavorite={() => handleToggleFavorite(item.id)}
                          onToggleBucketList={() => handleToggleBucketList(item.id)}
                          onPress={() => handleOpen(item.id)}
                        />
                      </View>
                    );
                  })}
                  {sharedLists.map((list) => (
                    <View key={list.shareId} style={styles.cardWithNote}>
                      <View style={styles.noteRow}>
                        <ThemedText type="small" themeColor="textSecondary" style={styles.shareNote}>
                          {list.direction === 'sent'
                            ? `Shared with ${list.otherPartyUsername ?? list.otherPartyDisplayName ?? 'someone'}${
                                list.recipientCount > 1 ? ` and ${list.recipientCount - 1} other${list.recipientCount > 2 ? 's' : ''}` : ''
                              }`
                            : `Shared by ${list.otherPartyUsername ?? list.otherPartyDisplayName ?? 'someone'}`}
                        </ThemedText>
                        <Pressable onPress={() => handleDeleteSharedList(list)} hitSlop={8}>
                          <Ionicons name="close-circle" size={18} color="#E05252" />
                        </Pressable>
                      </View>
                      <Pressable onPress={() => handleOpenSharedList(list)}>
                        <ThemedView type="backgroundElement" style={styles.sharedListCard}>
                          <ThemedText type="smallBold">{list.name}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {list.itemCount} {t('placeCount.label', { count: list.itemCount })}
                          </ThemedText>
                        </ThemedView>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
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
  scrollContent: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.five,
  },
  section: {
    gap: Spacing.three,
  },
  sectionList: {
    gap: Spacing.three,
  },
  cardWithNote: {
    gap: Spacing.one,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  shareNote: {
    flexShrink: 1,
    textAlign: 'right',
    fontStyle: 'italic',
  },
  savedListsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  savedListSlot: {
    width: '48%',
    marginBottom: Spacing.two,
  },
  sharedListCard: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  favoritesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.three,
  },
  /*
   * Two to a row. 48% rather than half, so the two per row are separated by the
   * remaining 4% — the grid is space-between and has no column gap of its own.
   */
  gridSlot: {
    width: '48%',
    gap: Spacing.one,
  },
  loggedOutPrompt: {
    flex: 1,
    gap: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  centerText: {
    textAlign: 'center',
  },
  primaryButton: {
    height: 48,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14747A',
  },
  primaryButtonText: {
    color: '#ffffff',
  },
  loadingIndicator: {
    marginTop: Spacing.six,
  },
  sectionEmptyText: {
    textAlign: 'center',
  },
});
