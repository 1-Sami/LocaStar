import { forgetDeviceToken, registerDeviceToken } from '@locastar/shared';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { t } from 'i18next';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/*
 * Show notifications that arrive while the app is open.
 *
 * Set at module scope so it is in place before the first one can land. Without
 * a handler expo-notifications discards them — the documented default is "not
 * to show the notification" — and that looks precisely like push being broken.
 * It cost an evening: Expo returned a delivery receipt from FCM while the phone
 * showed nothing at all, because the app happened to be in the foreground.
 *
 * shouldShowBanner and shouldShowList are the SDK 57 spelling. The older
 * shouldShowAlert is deprecated and does nothing, so a handler copied from an
 * older answer fails silently in exactly the same way.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    // The tab badge is counted from the database by NotificationsProvider, and
    // pushes are not the only thing that moves it. Letting the OS increment it
    // here as well would double-count and then drift apart.
    shouldSetBadge: false,
  }),
});

const ANDROID_CHANNEL_ID = 'default';

/**
 * Android will not display a notification without a channel — and, far less
 * obviously, will not even offer the permission prompt until one exists. So
 * this has to run *before* permissions are requested rather than after.
 */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: t('notifications.channelName'),
    description: t('notifications.channelDescription'),
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Ties the token to this Expo project; the call throws without it in release. */
function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/** The Expo token for this install, or null if it cannot be had. */
async function currentToken(): Promise<string | null> {
  // A simulator has no push service to register with, and asking produces a
  // confusing error rather than a prompt.
  if (!Device.isDevice) return null;
  const id = projectId();
  if (!id) return null;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId: id });
  return data ?? null;
}

/**
 * Asks for notification permission and records where to send.
 *
 * expo-notifications is a *native* module, so this file can only exist in a
 * bundle running on a binary that contains it. That is why the release script
 * publishes to `production` alone: the old preview build predates the module,
 * and a bundle importing it would crash that build on launch — which then
 * blocks every further update, because the app never lives long enough to fetch
 * one.
 */
export async function registerForPushNotifications(): Promise<void> {
  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;

    // Only ask when it has never been decided. Re-asking after a refusal does
    // nothing on either platform — the OS returns the previous answer without
    // showing anything — and iOS only ever presents the dialogue once.
    if (!granted && existing.canAskAgain) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted;
    }
    if (!granted) return;

    const token = await currentToken();
    if (!token) return;

    await registerDeviceToken(supabase, token, Platform.OS === 'ios' ? 'ios' : 'android');
  } catch {
    // Never fatal. Push is an extra: failing to register it must not stop
    // somebody using an app for finding basketball courts.
  }
}

/**
 * Stops this device receiving notifications meant for the person signing out.
 *
 * Called from signOut and nowhere else, deliberately. This used to live in an
 * effect cleanup keyed on the session object, which meant every token refresh —
 * hourly, and on every return to the foreground — deleted the row and raced to
 * write it back. The table was found empty while a reminder was due, which is
 * the one moment it has to be right: reminders are sent on a schedule, when the
 * app is closed and nothing is around to re-register.
 *
 * Must run *before* supabase.auth.signOut(). Delete is the one write the owner
 * may do directly, and that policy needs them to still be signed in.
 */
export async function unregisterPushNotifications(): Promise<void> {
  try {
    const token = await currentToken();
    if (token) await forgetDeviceToken(supabase, token);
  } catch {
    // The row is harmless if it lingers; the next person to sign in on this
    // device takes the token over, which is what register_device_token is for.
  }
}
