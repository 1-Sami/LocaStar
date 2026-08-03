import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
// Imported by name as well as through the namespace: lint and the React
// compiler both recognise a hook by its bare `use` prefix.
import { useUpdates } from 'expo-updates';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Don't ask the update server again more often than this. The launch check
// already covers cold starts; this is only for the person who leaves the app
// open for days and never relaunches it.
const RECHECK_AFTER_MS = 30 * 60 * 1000;

/**
 * "A new version is ready — Restart."
 *
 * expo-updates downloads a new bundle in the background but only *runs* it on
 * the next launch, so a fix reached people one relaunch later than it looked
 * like it had — and someone who never fully closes the app could stay on a
 * months-old bundle indefinitely. This turns that into one visible tap.
 *
 * Deliberately not automatic: reloading underneath someone throws away whatever
 * they were in the middle of typing. Deliberately not a push notification
 * either — the check runs when the app opens, which is the only moment the
 * answer can matter.
 */
export function UpdateBanner() {
  const theme = useTheme();
  const { isUpdatePending, isRestarting } = useUpdates();
  const [restartFailed, setRestartFailed] = useState(false);
  // Starts now, not at zero: expo-updates already checks on launch, and there
  // is nothing to learn from asking again a minute later.
  const lastCheck = useRef(Date.now());

  useEffect(() => {
    // checkForUpdateAsync and friends reject outright in dev, and there is no
    // update server behind Expo Go at all.
    if (!Updates.isEnabled || __DEV__) return;

    const check = async () => {
      if (Date.now() - lastCheck.current < RECHECK_AFTER_MS) return;
      lastCheck.current = Date.now();
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        // Offline, or the update server is unreachable. Nothing to tell the
        // user — they carry on with the bundle they have.
      }
    };

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => subscription.remove();
  }, []);

  if (!isUpdatePending) return null;

  const handleRestart = async () => {
    try {
      await Updates.reloadAsync();
    } catch {
      setRestartFailed(true);
    }
  };

  return (
    <View style={[styles.bar, { backgroundColor: theme.backgroundElement, borderTopColor: theme.backgroundSelected }]}>
      <Ionicons name="arrow-down-circle" size={20} color={theme.primary} />
      <View style={styles.textColumn}>
        <ThemedText type="smallBold">A new version is ready</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {restartFailed ? 'Restart failed — close and reopen the app.' : 'Restart to get the latest fixes.'}
        </ThemedText>
      </View>
      <Pressable
        onPress={handleRestart}
        disabled={isRestarting}
        style={[styles.button, { backgroundColor: theme.primary }, isRestarting && styles.buttonBusy]}>
        {isRestarting ? (
          <ActivityIndicator size="small" color={theme.background} />
        ) : (
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            Restart
          </ThemedText>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // In normal flow rather than floating over the app: an absolutely positioned
  // bar would sit on top of the tab bar on some screens and a header on others.
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  textColumn: {
    flex: 1,
    gap: 1,
  },
  button: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 8,
    minWidth: 76,
    alignItems: 'center',
  },
  buttonBusy: {
    opacity: 0.7,
  },
});
