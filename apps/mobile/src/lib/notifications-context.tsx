import { fetchUnreadNotificationCount } from '@locastar/shared';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { registerForPushNotifications } from '@/lib/push-registration';
import { supabase } from '@/lib/supabase';

// Often enough that a notification feels prompt, rare enough that it's just a
// count query. Only runs while the app is in the foreground — JS is suspended
// in the background, so this doesn't drain anything.
const POLL_INTERVAL_MS = 30_000;

type NotificationsContextValue = {
  unreadCount: number;
  refreshUnreadCount: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue>({
  unreadCount: 0,
  refreshUnreadCount: () => {},
});

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(() => {
    if (!session) {
      setUnreadCount(0);
      return;
    }
    fetchUnreadNotificationCount(supabase, session.user.id)
      .then(setUnreadCount)
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    refreshUnreadCount();
    if (!session) return;

    // This used to run only when the session changed — so anything that arrived
    // while the app was open stayed invisible until the next launch. Poll in the
    // foreground, and catch up immediately when returning from the background.
    const interval = setInterval(refreshUnreadCount, POLL_INTERVAL_MS);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshUnreadCount();
    });

    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, [refreshUnreadCount, session]);

  /*
   * Register this device for push once somebody is signed in.
   *
   * Keyed on the user id, not the session. onAuthStateChange hands back a new
   * session *object* on every token refresh — hourly, and on every return to
   * the foreground — so depending on the session re-ran this constantly. That
   * was survivable on its own; what was not is that the cleanup deleted the
   * token row, so the table sat empty between a refresh and the write that
   * followed it. Reminders are sent on a schedule, while the app is closed and
   * nothing is around to put the row back.
   *
   * Forgetting the device now happens in signOut, which is the only moment it
   * is actually wanted: the Expo token belongs to the install rather than the
   * account, so leaving it behind means the next person to hold a shared phone
   * gets somebody else's reminders on the lock screen.
   *
   * Deliberately fire-and-forget: registerForPushNotifications swallows its own
   * failures. Push is an extra, and nothing about finding a basketball court
   * should depend on it working.
   */
  /*
   * Signed out as well, since migration 0153.
   *
   * An Expo token belongs to the install, not the account, and requiring a
   * session to ask for one meant a closed tester who downloaded the app and
   * stopped at the sign-in screen could never be reached — including by the
   * notification asking them to sign up. Eight of twelve testers were in
   * exactly that state and invisible to us.
   *
   * Registering signed out stores the token with a null user_id; whoever signs
   * in on this device later claims it, and the fifteen-day campaign keeps its
   * place because it is keyed on the token rather than the person.
   *
   * Android only. iOS is live on the App Store, and asking a stranger for
   * notification permission on the launch screen — before they have seen what
   * the app is — is a good way to be told no once and for ever.
   */
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!userId && Platform.OS !== 'android') return;
    registerForPushNotifications();
  }, [userId]);

  return (
    <NotificationsContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsBadge() {
  return useContext(NotificationsContext);
}
