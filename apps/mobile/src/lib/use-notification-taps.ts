import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

/** A tester nudge that was tapped, to be shown in the app rather than opened. */
export type TappedNudge = {
  /** The notification's own id, so dismissing one cannot dismiss the next. */
  key: string;
  day: number;
  title: string;
  body: string;
};

export type NotificationTaps = {
  nudge: TappedNudge | null;
  dismissNudge: () => void;
};

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
 * The fifteen-day tester nudge is the one kind with nowhere to go. It is a
 * sentence, not a destination, so tapping it used to open the app and show
 * nothing — and anybody who glanced past the banner never learned what the day
 * had asked of them. It is returned here instead, for the caller to put on
 * screen, and is the only kind that does not clear the response: clearing takes
 * the text with it before it can be read.
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
export function useNotificationTaps(): NotificationTaps {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  const tapped =
    response && response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER
      ? response
      : null;
  const content = tapped?.notification.request.content;
  const day = nudgeDay(content?.data);
  const key = day === null ? null : (tapped?.notification.request.identifier ?? `nudge-${day}`);

  /*
   * Derived from the response rather than copied into state on a tap.
   *
   * Dismissal is remembered by the notification's own id, so the card closes
   * without needing the response to be cleared first — and the next nudge,
   * which has a different id, is not dismissed before it arrives.
   */
  const nudge: TappedNudge | null =
    day !== null && key !== null && key !== dismissedKey
      ? { key, day, title: content?.title ?? '', body: content?.body ?? '' }
      : null;

  const dismissNudge = useCallback(() => {
    if (key) setDismissedKey(key);
    Notifications.clearLastNotificationResponseAsync();
  }, [key]);

  useEffect(() => {
    // The hook keeps returning the same response until it is cleared, and this
    // effect re-runs on every navigation, so without clearing it the app would
    // yank you back to the same place every time you tried to leave it.
    if (!response) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;

    const data = response.notification.request.content.data;

    // A nudge is shown in place, not navigated to, and is cleared when the card
    // is closed. Clearing it here would blank the card the moment it appeared.
    if (nudgeDay(data) !== null) return;

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

  return { nudge, dismissNudge };
}

/**
 * The day a nudge is on, or null if this is not a nudge.
 *
 * Accepts a string as well as a number on purpose. The edge function sends a
 * JSON number, but an Android data payload travels through FCM as strings, so
 * what arrives is `"2"` on one platform and `2` on the other. Reading only the
 * number would have made this work on iOS and quietly do nothing on Android —
 * which is the only platform the campaign targets.
 */
function nudgeDay(data: unknown): number | null {
  const raw = (data as Record<string, unknown> | undefined)?.testerNudgeDay;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw);
  return null;
}
