import { useState } from 'react';
import { FlatList, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LocationCard } from '@/components/location-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { mockLocations } from '@/data/mock-locations';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const theme = useTheme();

  const results = mockLocations.filter((location) =>
    location.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedView type="backgroundElement" style={styles.searchBar}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </ThemedView>

        <ThemedText type="small" themeColor="textSecondary" style={styles.countText}>
          Total {results.length}/{mockLocations.length}
        </ThemedText>

        <FlatList
          data={results}
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
  searchBar: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
  },
  searchInput: {
    height: 44,
    fontSize: 16,
  },
  countText: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
});
