import { fetchCategories, fetchNearbyLocations, type Category, type NearbyLocation } from '@locastar/shared';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryChip } from '@/components/category-chip';
import { LocationCard } from '@/components/location-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSaves } from '@/hooks/use-saves';
import { useUserLocation } from '@/hooks/use-user-location';
import { useAuth } from '@/lib/auth-context';
import { nearbyLocationToCard } from '@/lib/location-adapters';
import { supabase } from '@/lib/supabase';

export default function HomeScreen() {
  const { coords } = useUserLocation();
  const { favoriteIds, bucketListIds, toggleFavorite, toggleBucketList } = useSaves();
  const { session } = useAuth();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [activeSlugs, setActiveSlugs] = useState<string[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [locations, setLocations] = useState<NearbyLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories(supabase)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    setLoading(true);
    fetchNearbyLocations(supabase, {
      lat: coords.latitude,
      lng: coords.longitude,
      categorySlugs: activeSlugs,
    })
      .then((result) => {
        if (!cancelled) setLocations(result);
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
  }, [coords, activeSlugs]);

  const cards = locations.map(nearbyLocationToCard);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            {/* TODO: swap for the real logo asset once it's added to assets/images/logo.png */}
            <View style={styles.logoPlaceholder}>
              <ThemedText type="smallBold" style={styles.logoPlaceholderText}>
                LS
              </ThemedText>
            </View>
            <ThemedText type="subtitle" style={styles.brandText}>
              LocaStar
            </ThemedText>
          </View>

          {session ? (
            <Pressable style={styles.accountRow} onPress={() => router.push('/profile')}>
              <View style={styles.accountTextColumn}>
                <ThemedText type="small" themeColor="textSecondary">
                  Logged in
                </ThemedText>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {session.user.email}
                </ThemedText>
              </View>
              <Image
                source={{ uri: `https://picsum.photos/seed/${session.user.id}/200/200` }}
                style={styles.avatar}
              />
            </Pressable>
          ) : (
            <Pressable onPress={() => router.push('/sign-in')}>
              <ThemedText type="linkPrimary">Log in</ThemedText>
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
            <Pressable style={styles.activitiesButton} onPress={() => setPickerVisible(true)}>
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

        <View style={styles.metaRow}>
          <ThemedText type="small" themeColor="textSecondary">
            {loading ? 'Loading…' : `Total ${cards.length}`}
          </ThemedText>
          <Pressable style={styles.sortButton}>
            <ThemedText type="small">Sort</ThemedText>
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
                No places found nearby yet.
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

      <Modal visible={pickerVisible} animationType="slide" transparent onRequestClose={() => setPickerVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerVisible(false)}>
          <ThemedView type="backgroundElement" style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              Activities
            </ThemedText>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  logoPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: Spacing.two,
    backgroundColor: '#14747A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlaceholderText: {
    color: '#ffffff',
  },
  brandText: {
    fontSize: 20,
    lineHeight: 24,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  accountTextColumn: {
    alignItems: 'flex-end',
    maxWidth: 140,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  filterRow: {
    flexGrow: 0,
  },
  filterRowContent: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    alignItems: 'center',
  },
  activitiesButton: {
    backgroundColor: '#B5432E',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.five,
    marginRight: Spacing.two,
  },
  activitiesButtonText: {
    color: '#ffffff',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  sortButton: {
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
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
});
