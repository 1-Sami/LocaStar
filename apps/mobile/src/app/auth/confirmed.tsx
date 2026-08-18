import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LocaStarLogo } from '@/components/locastar-logo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { APP_SCHEME_URL } from '@/lib/auth-redirect';

/**
 * Where confirmation links from auth email land.
 *
 * Auth mail has to point at an https address, because it gets opened wherever
 * someone reads their mail — often a desktop browser, which has no handler for
 * `locastar://`. So the link goes to the website and this page hands off to the
 * app from there. On Android the handoff is usually invisible: the intent
 * filter in app.json claims this exact URL, so a verified install opens the app
 * directly and the browser never appears.
 *
 * The tokens Supabase appends to the URL are deliberately ignored. Confirmation
 * already happened server-side by the time anyone gets here — the person is
 * signed in on their phone, where they signed up, and that session refreshes
 * itself when the app comes back to the foreground.
 */
export default function ConfirmedScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { refreshSession } = useAuth();

  // If the app itself opened this link, the account it is holding is now
  // confirmed. Pick that up rather than making the person sign out and back in.
  useEffect(() => {
    if (Platform.OS !== 'web') refreshSession();
  }, [refreshSession]);

  const openApp = () => {
    if (Platform.OS === 'web') {
      // Deliberately not fired automatically: on a desktop, or a phone without
      // the app, an unhandled scheme throws up a browser error dialog. A button
      // press is a choice, so the failure is at least explicable.
      window.location.href = APP_SCHEME_URL;
    } else {
      router.replace('/');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <LocaStarLogo size={72} />

          <ThemedText type="subtitle" style={styles.centered}>
            {t('authConfirmed.title')}
          </ThemedText>

          <ThemedText type="default" themeColor="textSecondary" style={styles.centered}>
            {Platform.OS === 'web'
              ? 'Your account is ready. Open LocaStar on your phone to get started.'
              : "You're all set — welcome to LocaStar."}
          </ThemedText>

          <Pressable
            onPress={openApp}
            style={[styles.button, { backgroundColor: theme.primary }]}>
            <ThemedText type="smallBold" style={styles.buttonText}>
              {Platform.OS === 'web' ? t('common.openApp') : t('auth.startExploring')}
            </ThemedText>
          </Pressable>

          {Platform.OS === 'web' && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
              {t('authConfirmed.fallback')}
            </ThemedText>
          )}
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
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    paddingHorizontal: Spacing.five,
  },
  centered: {
    textAlign: 'center',
  },
  button: {
    height: 48,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
  },
});
