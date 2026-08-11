import { forgetDeviceToken, registerDeviceToken } from '@locastar/shared';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/**
 * Asks for notification permission and records where to send.
 *
 * expo-notifications is a *native* module, so this file can only exist in a
 * bundle running on a binary that contains it. That is why the release script
 * publishes to `production` alone: the old preview build predates the module,
 * and a bundle importing it would crash that build on launch — which then
 * blocks every further update, because the app never lives long enough to fetch
 * one.
 *
 * Returns the token so the caller can forget it again on sign-out.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // A simulator has no push service to register with, and asking produces a
  // confusing error rather than a prompt.
  if (!Device.isDevice) return null;

  try {
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;

    // Only ask when it has never been decided. Re-asking after a refusal does
    // nothing on either platform — the OS returns the previous answer without
    // showing anything — and iOS only ever presents the dialogue once.
    if (!granted && existing.canAskAgain) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted;
    }
    if (!granted) return null;

    // projectId is what ties the token to this Expo project. Without it the
    // call throws in a release build, where the value cannot be inferred.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return null;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return null;

    await registerDeviceToken(supabase, token, Platform.OS === 'ios' ? 'ios' : 'android');
    return token;
  } catch {
    // Never fatal. Push is an extra: failing to register it must not stop
    // somebody using an app for finding basketball courts.
    return null;
  }
}

/** Stops this device receiving notifications meant for the person signing out. */
export async function unregisterPushNotifications(token: string): Promise<void> {
  try {
    await forgetDeviceToken(supabase, token);
  } catch {
    // The row is harmless if it lingers; the next person to sign in on this
    // device takes the token over, which is what register_device_token is for.
  }
}
