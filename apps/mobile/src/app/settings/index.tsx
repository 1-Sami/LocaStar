import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';

/*
 * Translation keys, not labels — the row order is fixed here and the words come
 * from the catalogue at render time so they follow a language change.
 *
 * `requiresAccount` marks the rows that cannot mean anything without one. Signed
 * out, what is left is language, theme and the two legal documents: exactly what
 * somebody deciding whether to sign up needs to be able to reach, and read in
 * their own language, before handing over an email address.
 */
const rows: { key: string; href: string; requiresAccount?: boolean }[] = [
  { key: 'nav.changePassword', href: '/settings/password', requiresAccount: true },
  { key: 'nav.accountInfo', href: '/settings/account', requiresAccount: true },
  { key: 'nav.language', href: '/settings/language' },
  { key: 'nav.theme', href: '/settings/theme' },
  { key: 'nav.notifications', href: '/settings/notifications', requiresAccount: true },
  { key: 'nav.blockedUsers', href: '/settings/blocked', requiresAccount: true },
  { key: 'nav.privacyPolicy', href: '/legal/privacy' },
  { key: 'nav.termsOfService', href: '/legal/terms' },
];

export default function SettingsMenuScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { session } = useAuth();

  const visibleRows = session ? rows : rows.filter((row) => !row.requiresAccount);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          {visibleRows.map((row) => (
            <Pressable key={row.href} onPress={() => router.push(row.href as never)}>
              <ThemedView type="backgroundElement" style={styles.menuItem}>
                <ThemedText type="default">{t(row.key)}</ThemedText>
                <ThemedText themeColor="textSecondary">›</ThemedText>
              </ThemedView>
            </Pressable>
          ))}

          {session && (
            <Pressable
              style={styles.deleteAccountButton}
              onPress={() => router.push('/settings/delete-account' as never)}>
              <ThemedText type="smallBold" style={styles.deleteAccountText}>
                {t('nav.deleteAccount')}
              </ThemedText>
            </Pressable>
          )}
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
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#8B1E1E',
    marginTop: Spacing.five,
  },
  deleteAccountText: {
    color: '#ffffff',
    fontSize: 9,
  },
});
