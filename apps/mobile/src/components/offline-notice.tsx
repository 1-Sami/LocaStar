import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * "No internet connection — showing what was saved at 13:00."
 *
 * Shown when a screen could not reach the server and fell back to its cached
 * copy. The time is the point of it: without a timestamp a stale address reads
 * as a bug rather than as the price of being offline, and the person has no way
 * to judge whether the opening hours in front of them are worth trusting.
 *
 * A bar rather than a toast, deliberately. A toast is gone before somebody
 * standing in a field has looked up, and this has to stay true for as long as
 * the screen it is explaining.
 *
 * Nothing here listens for the network. A fetch that failed is the signal, and
 * asking the OS instead would mean a native module, a new binary, and an app
 * store wait for a sentence.
 */
export function OfflineNotice({ savedAt }: { savedAt: string }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();

  const when = new Date(savedAt);
  // Time alone while it is today's copy, date as well once it is not — "13:00"
  // is a lie about something saved on Tuesday.
  const sameDay = when.toDateString() === new Date().toDateString();
  const stamp = sameDay
    ? when.toLocaleTimeString(i18n.language === 'sv' ? 'sv-SE' : 'en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : when.toLocaleDateString(i18n.language === 'sv' ? 'sv-SE' : 'en-GB', {
        day: 'numeric',
        month: 'short',
      });

  return (
    <View style={[styles.bar, { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name="cloud-offline-outline" size={16} color={theme.textSecondary} />
      <ThemedText style={[styles.text, { color: theme.textSecondary }]} numberOfLines={2}>
        {t('offline.showingSaved', { time: stamp })}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
    marginBottom: Spacing.three,
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
