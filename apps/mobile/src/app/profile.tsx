import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

const mockUser = {
  name: 'Sadek Mirza',
  email: 'sadek@example.com',
  avatarUrl: 'https://picsum.photos/seed/locastar-avatar/200/200',
};

const stats = [
  { label: 'Favorites', value: 7, color: '#E8A93B' },
  { label: 'Bucket list', value: 14, color: '#4C8FE8' },
  { label: 'Shared', value: 3, color: '#B0B4BA' },
  { label: 'Reviews', value: 9, color: '#4CD37A' },
  { label: 'Added', value: 1, color: '#C34CE8' },
];

const menuItems = ['My reviews', 'Add location', 'Add activity', 'Settings', 'About'];

export default function ProfileScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="subtitle" style={styles.header}>
          Profile
        </ThemedText>

        <View style={styles.profileRow}>
          <Image source={{ uri: mockUser.avatarUrl }} style={styles.avatar} />
          <View>
            <ThemedText type="link">Log in/out</ThemedText>
            <ThemedText type="smallBold">{mockUser.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {mockUser.email}
            </ThemedText>
          </View>
        </View>

        <View style={styles.statsRow}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statTile}>
              <ThemedText type="smallBold" style={{ color: stat.color }}>
                {stat.value}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {stat.label}
              </ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.menu}>
          {menuItems.map((item) => (
            <Pressable key={item}>
              <ThemedView type="backgroundElement" style={styles.menuItem}>
                <ThemedText type="default">{item}</ThemedText>
                <ThemedText themeColor="textSecondary">›</ThemedText>
              </ThemedView>
            </Pressable>
          ))}
        </View>

        <View style={styles.footer}>
          <ThemedText type="subtitle" themeColor="textSecondary" style={styles.brand}>
            LOCASTAR
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            EXPLORE. MAP. SHARE.
          </ThemedText>
        </View>
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
    paddingHorizontal: Spacing.three,
  },
  header: {
    fontSize: 20,
    lineHeight: 26,
    paddingVertical: Spacing.two,
  },
  profileRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  statTile: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128,128,128,0.4)',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    gap: Spacing.half,
  },
  menu: {
    gap: Spacing.two,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  footer: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingVertical: Spacing.six,
    opacity: 0.5,
  },
  brand: {
    fontSize: 22,
  },
});
