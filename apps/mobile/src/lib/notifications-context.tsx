import { fetchUnreadNotificationCount } from '@locastar/shared';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

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
  }, [refreshUnreadCount]);

  return (
    <NotificationsContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsBadge() {
  return useContext(NotificationsContext);
}
