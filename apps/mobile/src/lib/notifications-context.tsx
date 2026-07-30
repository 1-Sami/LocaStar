import { fetchUnreadNotificationCount } from '@locastar/shared';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/lib/auth-context';
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

  return (
    <NotificationsContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsBadge() {
  return useContext(NotificationsContext);
}
