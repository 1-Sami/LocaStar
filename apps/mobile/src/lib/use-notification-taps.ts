import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

/**
 * Opens whatever a tapped notification is about.
 *
 * The reminder push has carried `locationId` in its payload since the edge
 * function was written; nothing ever read it, so tapping a reminder dropped you
 * wherever the app happened to be last. That is worse than it sounds for this
 * particular notification: it arrives the day before something starts, and the
 * whole reason to tap it is to check where and when.
 *
 * send-social-notification-pushes (2026-08-24) added four more shapes on top
 * of that: `listId` for a shared list, and a bare `screen` for the two kinds
 * of notification with no single record to open — a friend request is
 * answered from the Friends page, not a page of its own, and a role grant
 * only makes sense next to the others on the notifications list.
 *
 * useLastNotificationResponse rather than addNotificationResponseReceivedListener
 * because it covers the cold start. A push typically lands on a locked phone,
 * so the app is usually not running when it is tapped — a listener registered
 * during startup is attached too late to hear about the tap that caused the
 * startup.
 *
 * Must be called inside the navigation tree: useRouter has nothing to push onto
 * above it.
 */
export function useNotificationTaps(): void {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    // The hook keeps returning the same response until it is cleared, and this
    // effect re-runs on every navigation, so without clearing it the app would
    // yank you back to the same place every time you tried to leave it.
    if (!response) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;

    const data = response.notification.request.content.data;
    const locationId = typeof data?.locationId === 'string' ? data.locationId : null;
    const listId = typeof data?.listId === 'string' ? data.listId : null;
    const screen = typeof data?.screen === 'string' ? data.screen : null;

    Notifications.clearLastNotificationResponseAsync();

    // Nothing to open is not an error: a notification may legitimately have no
    // destination, and guessing one is worse than staying put.
    if (locationId) {
      router.push({ pathname: '/location/[id]', params: { id: locationId } });
    } else if (listId) {
      router.push({ pathname: '/lists/[id]', params: { id: listId } });
    } else if (screen === 'friends') {
      router.push('/friends');
    } else if (screen === 'notifications') {
      router.push('/notifications');
    }
  }, [response, router]);
}
