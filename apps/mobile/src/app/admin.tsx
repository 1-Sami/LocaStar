import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MenuRow, MENU_ROW_WIDTH } from '@/components/menu-row';
import { ThemedView } from '@/components/themed-view';
import type { MenuId } from '@/constants/menu-icons';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSharedProfile } from '@/lib/profile-context';
import { markAdminSurfaceSeen, useAdminAlerts } from '@/lib/use-admin-alerts';

// Kept in their own group so moderation tools don't sit flush against the
// admin-only rows below. Superusers moderate content too, they just don't
// get the second group — see the `role === 'admin'` guard further down.
const MODERATOR_MENU_ITEMS: MenuId[] = ['reports', 'peopleAndBans', 'moderationLog'];
// Admin-only: superusers moderate content, they do not need to know which
// build is throwing or read the raw feedback queue.
const ADMIN_ONLY_MENU_ITEMS: MenuId[] = ['crashes', 'feedbackInbox'];

export default function AdminMenuScreen() {
  const router = useRouter();
  const { isModerator, role } = useSharedProfile();
  const alerts = useAdminAlerts(isModerator);

  const handlePress = (item: MenuId) => {
    if (item === 'reports') router.push('/admin-reports');
    if (item === 'peopleAndBans') router.push('/admin-users' as never);
    if (item === 'moderationLog') router.push('/admin-audit' as never);
    /*
     * Marked seen on the way in rather than inside the two screens.
     *
     * Both are plain lists that show everything they have, so opening one is
     * the whole of reading it — there is no further "handled" step to hang
     * this off. Doing it here also keeps the two screens unaware of the badge
     * that summarises them. Refreshing on focus means the count is already
     * gone by the time this screen is visible again.
     */
    if (item === 'crashes') {
      markAdminSurfaceSeen('crashes');
      router.push('/crash-reports' as never);
    }
    if (item === 'feedbackInbox') {
      markAdminSurfaceSeen('feedbackInbox');
      router.push('/feedback-inbox' as never);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          {isModerator && (
            <View style={styles.menu}>
              {MODERATOR_MENU_ITEMS.map((item) => (
                <MenuRow
                  key={item}
                  item={item}
                  badgeCount={item === 'reports' ? alerts.reports : undefined}
                  onPress={() => handlePress(item)}
                />
              ))}
            </View>
          )}

          {role === 'admin' && (
            <View style={[styles.menu, styles.menuGroupGap]}>
              {ADMIN_ONLY_MENU_ITEMS.map((item) => (
                <MenuRow
                  key={item}
                  item={item}
                  badgeCount={item === 'crashes' ? alerts.crashes : alerts.feedbackInbox}
                  onPress={() => handlePress(item)}
                />
              ))}
            </View>
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
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  content: {
    padding: Spacing.three,
  },
  menu: {
    width: MENU_ROW_WIDTH,
    gap: Spacing.one,
  },
  menuGroupGap: {
    marginTop: Spacing.three * 2,
  },
});
