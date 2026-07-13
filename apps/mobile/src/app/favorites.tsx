import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LocationCard } from '@/components/location-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { mockLocations } from '@/data/mock-locations';

const favorites = mockLocations.slice(0, 2);
const bucketList = mockLocations.slice(1, 4);
const shared = mockLocations.slice(3, 5);

function Section({ title, items }: { title: string; items: typeof mockLocations }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <ThemedText type="subtitle" style={styles.sectionTitle}>
        {title} <ThemedText themeColor="textSecondary">{items.length}</ThemedText>
      </ThemedText>
      <View style={styles.sectionList}>
        {items.map((item) => (
          <LocationCard key={item.id} location={item} />
        ))}
      </View>
    </View>
  );
}

export default function FavoritesScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Section title="Favorites" items={favorites} />
          <Section title="Bucket list" items={bucketList} />
          <Section title="Shared" items={shared} />
        </ScrollView>
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
});
