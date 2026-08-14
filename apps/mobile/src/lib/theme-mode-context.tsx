import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchProfile, updateProfile, type ThemePreference } from '@locastar/shared';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

type ThemeModeContextValue = {
  mode: ThemePreference;
  resolvedScheme: 'light' | 'dark';
  setMode: (mode: ThemePreference) => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(undefined);

/*
 * The signed-out copy of the choice.
 *
 * The profile is the source of truth for someone signed in, and it stays that
 * way. But Settings is reachable without an account — that is the point of it
 * being there — and the profile is not, so without this the theme row applied
 * instantly and then forgot itself the next time the app started. A setting
 * that does not survive a restart is worse than no setting.
 */
const STORAGE_KEY = 'locastar.theme';

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemePreference>('system');

  useEffect(() => {
    let cancelled = false;

    if (!session) {
      AsyncStorage.getItem(STORAGE_KEY)
        .then((stored) => {
          if (!cancelled && isThemePreference(stored)) setModeState(stored);
        })
        .catch(() => {
          // Storage unavailable. 'system' is already the state, and following
          // the phone is the right thing to fall back to.
        });
      return () => {
        cancelled = true;
      };
    }

    fetchProfile(supabase, session.user.id)
      .then((profile) => {
        if (!cancelled) setModeState(profile.theme_preference);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session]);

  const setMode = (next: ThemePreference) => {
    setModeState(next);
    // Written either way: the account keeps it across devices, storage keeps it
    // across restarts on this one, and only one of those exists when signed out.
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
    if (session) {
      updateProfile(supabase, session.user.id, { theme_preference: next }).catch(() => {});
    }
  };

  const resolvedScheme = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  return (
    <ThemeModeContext.Provider value={{ mode, resolvedScheme, setMode }}>
      {children}
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeModeProvider');
  }
  return context;
}
