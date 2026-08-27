import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ScreenTitle } from '@/components/screen-title';
import { UpdateBanner } from '@/components/update-banner';
import { AuthProvider } from '@/lib/auth-context';
import { installCrashReporter, setCrashRoute } from '@/lib/crash-reporting';
// Imported for the side effect of initialising i18next before any screen calls
// useTranslation. loadStoredLanguage applies the saved override afterwards.
import { loadStoredLanguage } from '@/lib/i18n';
import { NotificationsProvider } from '@/lib/notifications-context';
import { ProfileProvider } from '@/lib/profile-context';
import { useNotificationTaps } from '@/lib/use-notification-taps';
import { ThemeModeProvider, useThemeMode } from '@/lib/theme-mode-context';

SplashScreen.preventAutoHideAsync();

// At module scope on purpose: a handler installed inside an effect is
// registered after the first render, and the errors most worth catching are
// the ones that happen before anything has rendered at all.
installCrashReporter();

function ThemedNavigation() {
  const { resolvedScheme } = useThemeMode();
  // Titles come from the catalogue, so a language change has to re-render this
  // component — that is what useTranslation subscribes it to.
  const { t } = useTranslation();
  // Here rather than in RootLayout: it needs a router to push onto, and the
  // navigation tree only exists from this component down.
  useNotificationTaps();
  /*
   * Tell the crash reporter where we are.
   *
   * Without this the route column was always null: the setter existed and
   * nothing ever called it, so every report said only *what* broke and never
   * *where*, which is the first thing anyone asks. Here rather than in a
   * screen, because usePathname needs the router and this is the highest
   * component that has one.
   */
  const pathname = usePathname();
  useEffect(() => {
    setCrashRoute(pathname);
  }, [pathname]);
  return (
    <ThemeProvider value={resolvedScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/*
       * Without this, the system status bar (clock, battery, carrier icons)
       * followed the phone's own OS-level appearance instead of LocaStar's own
       * theme setting — nothing here ever called expo-status-bar, so it just
       * fell back to whatever the OS chose. Someone whose phone is in dark
       * mode but who set the app itself to light got white system icons on a
       * white app background: invisible. Tying it to resolvedScheme (the
       * app's own resolved choice, already accounting for a "system" override)
       * is what makes it agree with what the screen is actually showing.
       */}
      <StatusBar style={resolvedScheme === 'dark' ? 'light' : 'dark'} />
      <AnimatedSplashOverlay />
      {/* The banner is a sibling in normal flow, so it takes its own strip at
          the bottom rather than covering the tab bar or a screen header. */}
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            // Otherwise the back button falls back to the previous screen's
            // route name when nothing else is set — which for anything pushed
            // from within the tab bar is '(tabs)', the Expo Router group
            // folder, showing up as literal text on every back button in the
            // app. A chevron with no label is standard iOS 13+ style anyway.
            headerBackButtonDisplayMode: 'minimal',
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ presentation: 'modal', title: t('nav.logIn') }} />
          <Stack.Screen name="sign-up" options={{ presentation: 'modal', title: t('nav.signUp') }} />
          <Stack.Screen name="forgot-password" options={{ presentation: 'modal', title: t('nav.resetPassword') }} />
          <Stack.Screen name="reset-password" options={{ presentation: 'modal', title: t('nav.resetPassword') }} />
          <Stack.Screen name="auth/confirmed" options={{ headerShown: false }} />
          <Stack.Screen name="location/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="write-review" options={{ presentation: 'modal', title: t('nav.writeReview') }} />
          <Stack.Screen name="favorites" options={{ headerTitle: () => <ScreenTitle titleKey="saved" /> }} />
          <Stack.Screen name="my-reviews" options={{ headerTitle: () => <ScreenTitle titleKey="myReviews" /> }} />
          <Stack.Screen name="my-locations" options={{ headerTitle: () => <ScreenTitle titleKey="myContributions" /> }} />
          <Stack.Screen name="add-location" options={{ presentation: 'modal' }} />
          <Stack.Screen name="edit-location" options={{ presentation: 'modal', title: t('nav.editLocation') }} />
          <Stack.Screen name="settings/index" options={{ headerTitle: () => <ScreenTitle titleKey="settings" /> }} />
          <Stack.Screen name="settings/profile-picture" options={{ title: t('nav.profilePicture') }} />
          <Stack.Screen name="settings/password" options={{ title: t('nav.changePassword') }} />
          <Stack.Screen name="settings/account" options={{ title: t('nav.accountInfo') }} />
          <Stack.Screen name="settings/language" options={{ title: t('nav.language') }} />
          <Stack.Screen name="settings/theme" options={{ title: t('nav.theme') }} />
          <Stack.Screen name="settings/notifications" options={{ title: t('nav.notifications') }} />
          <Stack.Screen name="settings/blocked" options={{ title: t('nav.blockedUsers') }} />
          <Stack.Screen name="settings/delete-account" options={{ title: t('nav.deleteAccount') }} />
          <Stack.Screen name="about" options={{ headerTitle: () => <ScreenTitle titleKey="about" /> }} />
          <Stack.Screen name="legal/privacy" options={{ title: t('nav.privacyPolicy') }} />
          <Stack.Screen name="legal/terms" options={{ title: t('nav.termsOfService') }} />
          {/* Reachable in the app, but its real job is being a public URL: Google
              Play requires one on the Data safety form and shows it on the listing. */}
          <Stack.Screen name="legal/delete-account" options={{ title: t('nav.deleteAccount') }} />
          <Stack.Screen name="admin" options={{ headerTitle: () => <ScreenTitle titleKey="admin" /> }} />
          <Stack.Screen name="admin-reports" options={{ headerTitle: () => <ScreenTitle titleKey="reports" /> }} />
          <Stack.Screen name="admin-users" options={{ headerTitle: () => <ScreenTitle titleKey="peopleAndBans" /> }} />
          <Stack.Screen name="admin-audit" options={{ headerTitle: () => <ScreenTitle titleKey="moderationLog" /> }} />
          <Stack.Screen name="crash-reports" options={{ headerTitle: () => <ScreenTitle titleKey="crashes" /> }} />
          <Stack.Screen name="send-feedback" options={{ headerTitle: () => <ScreenTitle titleKey="sendFeedback" /> }} />
          <Stack.Screen name="feedback-inbox" options={{ headerTitle: () => <ScreenTitle titleKey="feedbackInbox" /> }} />
          <Stack.Screen name="lists/index" options={{ headerTitle: () => <ScreenTitle titleKey="myLists" /> }} />
          <Stack.Screen name="lists/[id]" options={{ title: t('nav.list') }} />
          <Stack.Screen name="friends" options={{ headerTitle: () => <ScreenTitle titleKey="friends" /> }} />
          <Stack.Screen name="notifications" options={{ headerTitle: () => <ScreenTitle titleKey="notifications" /> }} />
        </Stack>
        <UpdateBanner />
      </View>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  // Fire and forget: i18next is already initialised with the device language,
  // so this only swaps in a stored override. Nothing renders differently until
  // it resolves, and if it never does the device language stands.
  useEffect(() => {
    loadStoredLanguage();
  }, []);

  return (
    <AuthProvider>
      <ProfileProvider>
        <NotificationsProvider>
          <ThemeModeProvider>
            <ThemedNavigation />
          </ThemeModeProvider>
        </NotificationsProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}
