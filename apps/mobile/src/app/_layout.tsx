import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider } from '@/lib/auth-context';
import { NotificationsProvider } from '@/lib/notifications-context';
import { ProfileProvider } from '@/lib/profile-context';
import { ThemeModeProvider, useThemeMode } from '@/lib/theme-mode-context';

SplashScreen.preventAutoHideAsync();

function ThemedNavigation() {
  const { resolvedScheme } = useThemeMode();
  return (
    <ThemeProvider value={resolvedScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ presentation: 'modal', title: 'Log in' }} />
        <Stack.Screen name="sign-up" options={{ presentation: 'modal', title: 'Sign up' }} />
        <Stack.Screen name="forgot-password" options={{ presentation: 'modal', title: 'Reset password' }} />
        <Stack.Screen name="reset-password" options={{ presentation: 'modal', title: 'Reset password' }} />
        <Stack.Screen name="location/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="write-review" options={{ presentation: 'modal', title: 'Write a review' }} />
        <Stack.Screen name="my-reviews" options={{ title: 'My reviews' }} />
        <Stack.Screen name="add-location" options={{ presentation: 'modal' }} />
        <Stack.Screen name="edit-location" options={{ presentation: 'modal', title: 'Edit location' }} />
        <Stack.Screen name="settings/index" options={{ title: 'Settings' }} />
        <Stack.Screen name="settings/profile-picture" options={{ title: 'Profile picture' }} />
        <Stack.Screen name="settings/password" options={{ title: 'Change password' }} />
        <Stack.Screen name="settings/account" options={{ title: 'Account info' }} />
        <Stack.Screen name="settings/address" options={{ title: 'Address' }} />
        <Stack.Screen name="settings/theme" options={{ title: 'Theme' }} />
        <Stack.Screen name="settings/notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="settings/delete-account" options={{ title: 'Delete account' }} />
        <Stack.Screen name="about" options={{ title: 'About' }} />
        <Stack.Screen name="admin-reports" options={{ title: 'Reports' }} />
        <Stack.Screen name="lists/index" options={{ title: 'My lists' }} />
        <Stack.Screen name="lists/[id]" options={{ title: 'List' }} />
        <Stack.Screen name="friends" options={{ title: 'Friends' }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
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
