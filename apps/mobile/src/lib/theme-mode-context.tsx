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

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemePreference>('system');

  useEffect(() => {
    if (!session) {
      setModeState('system');
      return;
    }
    let cancelled = false;
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
