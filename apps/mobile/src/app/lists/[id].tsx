import { deleteList, fetchListItems, removeLocationFromList, type ListItemLocation } from '@locastar/shared';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StarRating } from '@/components/star-rating';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { confirmAsync } from '@/lib/confirm';
import { supabase } from '@/lib/supabase';

export default function ListDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();

  const [items, setItems] = useState<ListItemLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyLocationId, setBusyLocationId] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!id) return;
    setLoading(true);
    fetchListItems(supabase, id)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const handleRemove = async (locationId: string) => {
    const confirmed = await confirmAsync('Remove from list?', 'This place will be removed from this list.');
    if (!confirmed) return;
    setBusyLocationId(locationId);
    try {
      await removeLocationFromList(supabase, id, locationId);
      setItems((current) => current.filter((item) => item.locationId !== locationId));
    } finally {
      setBusyLocationId(null);
    }
  };

  const handleDeleteList = async () => {
    const confirmed = await confirmAsync(
      'Delete this list?',
      'This permanently deletes the list and removes all its places. This can\'t be undone.'
    );
    if (!confirmed) return;
    await deleteList(supabase, id);
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: name ?? 'List' }} />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        {loading ? (
          <ActivityIndicator style={styles.loadingIndicator} />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {items.length === 0 ? (
              <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
                No places in this list yet. Add one from a location's page.
              </ThemedText>
            ) : (
              items.map((item) => (
                <ThemedView key={item.locationId} type="backgroundElement" style={styles.card}>
                  <Pressable onPress={() => router.push({ pathname: '/location/[id]', params: { id: item.locationId } })}>
                    <ThemedText type="smallBold">{item.name}</ThemedText>
                  </Pressable>
                  <View style={styles.ratingRow}>
                    <StarRating rating={item.avgRating} size={14} />
                    <ThemedText type="small" themeColor="textSecondary">
                      {item.avgRating.toFixed(1)} · {item.reviewCount} reviews
                    </ThemedText>
                  </View>
                  {item.note && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {item.note}
                    </ThemedText>
                  )}
                  <Pressable
                    onPress={() => handleRemove(item.locationId)}
                    disabled={busyLocationId === item.locationId}
                    style={styles.removeButton}>
                    <ThemedText type="small" style={styles.removeButtonText}>
                      Remove from list
                    </ThemedText>
                  </Pressable>
                </ThemedView>
              ))
            )}

            <Pressable style={styles.deleteListButton} onPress={handleDeleteList}>
              <ThemedText type="smallBold" style={styles.deleteListButtonText}>
                Delete this list
              </ThemedText>
            </Pressable>
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
  },
  loadingIndicator: {
    marginTop: Spacing.six,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  card: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  removeButton: {
    marginTop: Spacing.one,
    alignSelf: 'flex-start',
  },
  removeButtonText: {
    color: '#E05252',
  },
  deleteListButton: {
    height: 48,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(224,82,82,0.15)',
    marginTop: Spacing.three,
  },
  deleteListButtonText: {
    color: '#E05252',
  },
});
