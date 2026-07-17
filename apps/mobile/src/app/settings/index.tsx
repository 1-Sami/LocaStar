import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

const rows: { label: string; href: string }[] = [
  { label: 'Change password', href: '/settings/password' },
  { label: 'Account info', href: '/settings/account' },
  { label: 'Address', href: '/settings/address' },
  { label: 'Theme', href: '/settings/theme' },
  { label: 'Notifications', href: '/settings/notifications' },
];

export default function SettingsMenuScreen() {
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          {rows.map((row) => (
            <Pressable key={row.href} onPress={() => router.push(row.href as never)}>
              <ThemedView type="backgroundElement" style={styles.menuItem}>
                <ThemedText type="default">{row.label}</ThemedText>
                <ThemedText themeColor="textSecondary">›</ThemedText>
              </ThemedView>
            </Pressable>
          ))}

          <Pressable
            style={styles.deleteAccountButton}
            onPress={() => router.push('/settings/delete-account' as never)}>
            <ThemedText type="smallBold" style={styles.deleteAccountText}>
              Delete account
            </ThemedText>
          </Pressable>
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
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'flex-start',
    width: '62%',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  deleteAccountButton: {
    alignSelf: 'flex-end',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 999,
    backgroundColor: '#8B1E1E',
    marginTop: Spacing.four,
  },
  deleteAccountText: {
    color: '#ffffff',
  },
});
