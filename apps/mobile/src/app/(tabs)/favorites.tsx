import { fetchSavedLocations, fetchSharedLocations } from '@locastar/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LocationCard } from '@/components/location-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSaves } from '@/hooks/use-saves';
import { useAuth } from '@/lib/auth-context';
import { savedLocationToCard } from '@/lib/location-adapters';
import { supabase } from '@/lib/supabase';
import type { CardLocation } from '@/types/location';

function Section({
  title,
  items,
  favoriteIds,
  bucketListIds,
  onToggleFavorite,
  onToggleBucketList,
  onOpen,
}: {
  title: string;
  items: CardLocation[];
  favoriteIds: Set<string>;
  bucketListIds: Set<string>;
  onToggleFavorite: (id: string) => void;
  onToggleBucketList: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <ThemedText type="subtitle" style={styles.sectionTitle}>
        {title} <ThemedText themeColor="textSecondary">{items.length}</ThemedText>
      </ThemedText>
      <View style={styles.sectionList}>
        {items.map((item) => (
          <LocationCard
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
    </View>
  );
}

export default function FavoritesScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { favoriteIds, bucketListIds, toggleFavorite, toggleBucketList } = useSaves();

  const [favorites, setFavorites] = useState<CardLocation[]>([]);
  const [bucketList, setBucketList] = useState<CardLocation[]>([]);
  const [shared, setShared] = useState<CardLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [favoriteRows, bucketListRows, sharedRows] = await Promise.all([
        fetchSavedLocations(supabase, session.user.id, 'favorite'),
        fetchSavedLocations(supabase, session.user.id, 'bucket_list'),
        fetchSharedLocations(supabase, session.user.id),
      ]);
      setFavorites(favoriteRows.map(savedLocationToCard));
      setBucketList(bucketListRows.map(savedLocationToCard));
      setShared(sharedRows.map(savedLocationToCard));
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

  const nothingSaved = favorites.length === 0 && bucketList.length === 0 && shared.length === 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {loading ? (
          <ActivityIndicator style={styles.loadingIndicator} />
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Section
              title="Favorites"
              items={favorites}
              favoriteIds={favoriteIds}
              bucketListIds={bucketListIds}
              onToggleFavorite={handleToggleFavorite}
              onToggleBucketList={handleToggleBucketList}
              onOpen={handleOpen}
            />
            <Section
              title="Bucket list"
              items={bucketList}
              favoriteIds={favoriteIds}
              bucketListIds={bucketListIds}
              onToggleFavorite={handleToggleFavorite}
              onToggleBucketList={handleToggleBucketList}
              onOpen={handleOpen}
            />
            <Section
              title="Shared"
              items={shared}
              favoriteIds={favoriteIds}
              bucketListIds={bucketListIds}
              onToggleFavorite={handleToggleFavorite}
              onToggleBucketList={handleToggleBucketList}
              onOpen={handleOpen}
            />
            {nothingSaved && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                Nothing saved yet — tap the heart or star on a place to save it here.
              </ThemedText>
            )}
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
  sectionTitle: {
    fontSize: 20,
    lineHeight: 26,
  },
  sectionList: {
    gap: Spacing.three,
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
  emptyText: {
    textAlign: 'center',
    marginTop: Spacing.four,
  },
});
