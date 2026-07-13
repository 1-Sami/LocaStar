import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';

const stats = [
  { label: 'Favorites', value: 7, color: '#E8A93B' },
  { label: 'Bucket list', value: 14, color: '#4C8FE8' },
  { label: 'Shared', value: 3, color: '#B0B4BA' },
  { label: 'Reviews', value: 9, color: '#4CD37A' },
  { label: 'Added', value: 1, color: '#C34CE8' },
];

const menuItems = ['My reviews', 'Add location', 'Add activity', 'Settings', 'About'];

function BrandFooter() {
  return (
    <View style={styles.footer}>
      <ThemedText type="subtitle" themeColor="textSecondary" style={styles.brand}>
        LOCASTAR
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        EXPLORE. MAP. SHARE.
      </ThemedText>
    </View>
  );
}

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();

  if (!session) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <ThemedText type="subtitle" style={styles.header}>
            Profile
          </ThemedText>
          <View style={styles.loggedOutPrompt}>
            <ThemedText type="default" themeColor="textSecondary" style={styles.centerText}>
              Log in to save favorites, write reviews, and add your own locations.
            </ThemedText>
            <Pressable style={styles.primaryButton} onPress={() => router.push('/sign-in')}>
              <ThemedText type="smallBold" style={styles.primaryButtonText}>
                Log in
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => router.push('/sign-up')}>
              <ThemedText type="linkPrimary">Create an account</ThemedText>
            </Pressable>
          </View>
          <BrandFooter />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="subtitle" style={styles.header}>
          Profile
        </ThemedText>

        <View style={styles.profileRow}>
          <Image
            source={{ uri: `https://picsum.photos/seed/${session.user.id}/200/200` }}
            style={styles.avatar}
          />
          <View>
            <Pressable onPress={signOut}>
              <ThemedText type="link">Log out</ThemedText>
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary">
              {session.user.email}
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

        <BrandFooter />
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
  loggedOutPrompt: {
    gap: Spacing.three,
    alignItems: 'center',
    paddingVertical: Spacing.six,
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
