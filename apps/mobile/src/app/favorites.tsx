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
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FavoriteCard } from '@/components/favorite-card';
import { ListCard } from '@/components/list-card';
import { LocationCard } from '@/components/location-card';
import { SectionBadge } from '@/components/section-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSaves } from '@/hooks/use-saves';
import { useAuth } from '@/lib/auth-context';
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
        <View style={styles.sectionList}>
          {items.map((item, index) => {
            const note = noteForItem?.(item, index);
            return (
              <View key={`${item.id}-${index}`} style={styles.cardWithNote}>
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
                <LocationCard
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
            <FavoriteCard
              key={item.id}
              location={item}
              isFavorite={favoriteIds.has(item.id)}
              isBucketListed={bucketListIds.has(item.id)}
              onToggleFavorite={() => onToggleFavorite(item.id)}
              onToggleBucketList={() => onToggleBucketList(item.id)}
              onPress={() => onOpen(item.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

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
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

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
    setLoading(true);
    try {
      const [favoriteRows, bucketListRows, shareRows, sharedListRows, savedListRows] = await Promise.all([
        fetchSavedLocations(supabase, session.user.id, 'favorite'),
        fetchSavedLocations(supabase, session.user.id, 'bucket_list'),
        fetchMyShares(supabase, session.user.id),
        fetchMyListShares(supabase, session.user.id),
        fetchSavedLists(supabase, session.user.id),
      ]);
      setFavorites(favoriteRows.map(savedLocationToCard));
      setBucketList(bucketListRows.map(savedLocationToCard));
      setShares(shareRows);
      setSharedLists(sharedListRows);
      setSavedLists(savedListRows);
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  }, [session]);

  // On focus rather than on mount: saving or sharing something from another
  // screen used to leave this list stale until the app was restarted.
  useFocusEffect(
    useCallback(() => {
      reload().catch(() => {});
    }, [reload])
  );

  const handleToggleFavorite = async (id: string) => {
    await toggleFavorite(id);
    reload().catch(() => {});
  };
  const handleToggleBucketList = async (id: string) => {
    await toggleBucketList(id);
    reload().catch(() => {});
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
        ) : (
          <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent}>
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

            {savedLists.length > 0 && (
              <View style={styles.section} onLayout={handleSectionLayout('savedLists')}>
                <SectionBadge label={t('saved.savedLists')} count={savedLists.length} backgroundColor="#2BA3A3" />
                <View style={styles.savedListsGrid}>
                  {savedLists.map((list) => (
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
                      <View key={`${item.id}-${index}`} style={styles.cardWithNote}>
                        <View style={styles.noteRow}>
                          <ThemedText type="small" themeColor="textSecondary" style={styles.shareNote}>
                            {note}
                          </ThemedText>
                          <Pressable onPress={() => handleDeleteShare(index)} hitSlop={8}>
                            <Ionicons name="close-circle" size={18} color="#E05252" />
                          </Pressable>
                        </View>
                        <LocationCard
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
                            {list.itemCount} {list.itemCount === 1 ? 'place' : 'places'}
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
