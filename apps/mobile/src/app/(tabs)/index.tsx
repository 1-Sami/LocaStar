import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryChip } from '@/components/category-chip';
import { LocationCard } from '@/components/location-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { mockLocations } from '@/data/mock-locations';

const DEFAULT_FILTERS = [
  { slug: 'golf', label: 'Golf' },
  { slug: 'skiing', label: 'Skiing' },
  { slug: 'bmx', label: 'BMX' },
];

export default function HomeScreen() {
  const [activeFilters, setActiveFilters] = useState(DEFAULT_FILTERS);

  const visibleLocations =
    activeFilters.length === 0
      ? mockLocations
      : mockLocations.filter((location) =>
          activeFilters.some((filter) => filter.slug === location.categorySlug)
        );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="subtitle">LocaStar</ThemedText>
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={styles.filterRowContent}
          data={activeFilters}
          keyExtractor={(item) => item.slug}
          ListHeaderComponent={
            <Pressable style={styles.activitiesButton}>
              <ThemedText type="smallBold" style={styles.activitiesButtonText}>
                Activities ▾
              </ThemedText>
            </Pressable>
          }
          renderItem={({ item }) => (
            <CategoryChip
              label={item.label}
              categorySlug={item.slug}
              onRemove={() =>
                setActiveFilters((current) => current.filter((f) => f.slug !== item.slug))
              }
            />
          )}
        />

        <View style={styles.metaRow}>
          <ThemedText type="small" themeColor="textSecondary">
            Total {visibleLocations.length}/{mockLocations.length}
          </ThemedText>
          <Pressable style={styles.sortButton}>
            <ThemedText type="small">Sort</ThemedText>
          </Pressable>
        </View>

        <FlatList
          data={visibleLocations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <LocationCard location={item} />}
        />
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
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
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
});
