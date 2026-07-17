import { fetchSavedLocations, fetchSentShares, type SentShare } from '@locastar/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { LocationCard } from '@/components/location-card';
import { SectionBadge } from '@/components/section-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSaves } from '@/hooks/use-saves';
import { useAuth } from '@/lib/auth-context';
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
                {note && (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.shareNote}>
                    {note}
                  </ThemedText>
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
  return (
    <View style={styles.section} onLayout={onLayout}>
      <SectionBadge label="Favorites" count={items.length} backgroundColor="#E8A93B" textColor="#1A1400" />
      {items.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.sectionEmptyText}>
          Nothing saved yet — tap the heart on a location to start saving your favorites.
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
  const { session } = useAuth();
  const router = useRouter();
  const { section: sectionParam } = useLocalSearchParams<{ section?: string }>();
  const { favoriteIds, bucketListIds, toggleFavorite, toggleBucketList } = useSaves();

  const [favorites, setFavorites] = useState<CardLocation[]>([]);
  const [bucketList, setBucketList] = useState<CardLocation[]>([]);
  const [sentShares, setSentShares] = useState<SentShare[]>([]);
  const [loading, setLoading] = useState(true);

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
      const [favoriteRows, bucketListRows, sentShareRows] = await Promise.all([
        fetchSavedLocations(supabase, session.user.id, 'favorite'),
        fetchSavedLocations(supabase, session.user.id, 'bucket_list'),
        fetchSentShares(supabase, session.user.id),
      ]);
      setFavorites(favoriteRows.map(savedLocationToCard));
      setBucketList(bucketListRows.map(savedLocationToCard));
      setSentShares(sentShareRows);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    reload().catch(() => {});
  }, [reload]);

  const handleToggleFavorite = async (id: string) => {
    await toggleFavorite(id);
    reload().catch(() => {});
  };
  const handleToggleBucketList = async (id: string) => {
    await toggleBucketList(id);
    reload().catch(() => {});
  };
  const handleOpen = (id: string) => router.push({ pathname: '/location/[id]', params: { id } });

  if (!session) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.loggedOutPrompt}>
            <ThemedText type="default" themeColor="textSecondary" style={styles.centerText}>
              Log in to see your favorites, bucket list, and shared places.
            </ThemedText>
            <Pressable style={styles.primaryButton} onPress={() => router.push('/sign-in')}>
              <ThemedText type="smallBold" style={styles.primaryButtonText}>
                Log in
              </ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const sharedCards = sentShares.map(savedLocationToCard);
  const sharedNote = (_item: CardLocation, index: number) => {
    const share = sentShares[index];
    const name = share?.recipientUsername ?? share?.recipientDisplayName;
    return name ? `Shared with ${name}` : null;
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {loading ? (
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
              title="Bucket list"
              badgeColor="#4C8FE8"
              items={bucketList}
              favoriteIds={favoriteIds}
              bucketListIds={bucketListIds}
              onToggleFavorite={handleToggleFavorite}
              onToggleBucketList={handleToggleBucketList}
              onOpen={handleOpen}
              onLayout={handleSectionLayout('bucketList')}
              emptyMessage="Nothing saved yet — tap the star on a location to start saving your planned trips."
            />
            <FullSection
              title="Shared"
              badgeColor="#B0B4BA"
              items={sharedCards}
              favoriteIds={favoriteIds}
              bucketListIds={bucketListIds}
              onToggleFavorite={handleToggleFavorite}
              onToggleBucketList={handleToggleBucketList}
              onOpen={handleOpen}
              onLayout={handleSectionLayout('shared')}
              noteForItem={sharedNote}
              emptyMessage="Nothing shared yet — share a location to see it here."
            />
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
    paddingBottom: BottomTabInset + Spacing.four,
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
  shareNote: {
    textAlign: 'right',
    fontStyle: 'italic',
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
