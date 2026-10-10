import type { Session } from '@locastar/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { authRedirectTo } from '@/lib/auth-redirect';
import { unregisterPushNotifications } from '@/lib/push-registration';
import { authErrorKey } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (
    email: string,
    password: string,
    username: string
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Pulls a new access token, which is the only way a change made outside the
  // app — confirming an email address, most of all — reaches the client.
  const refreshSession = useCallback(async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) setSession(data.session);
  }, []);

  // Confirming an email happens in a browser, so the app is never told. Someone
  // who signs up, taps the link in their mail app and switches back would
  // otherwise still be sitting in front of "check your email" with no way
  // forward but signing out. Watch for the return to the foreground, and only
  // while there is actually something to learn.
  const awaitingConfirmation = Boolean(session && !session.user.email_confirmed_at);
  useEffect(() => {
    if (!awaitingConfirmation) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshSession();
    });
    return () => subscription.remove();
  }, [awaitingConfirmation, refreshSession]);

  // Returns a translation key, not a sentence — see lib/auth-errors. The
  // screens hold `t`; this context deliberately does not.
  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? authErrorKey(error) : null };
  };

  const signUpWithPassword = async (email: string, password: string, username: string) => {
    // handle_new_user() reads this to set the profile's handle, so people
    // aren't given one derived from their email address.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username }, emailRedirectTo: authRedirectTo('/auth/confirmed') },
    });
    if (error) return { error: authErrorKey(error), needsEmailConfirmation: false };

    // Supabase deliberately answers a sign-up for an already-registered email
    // with a success-shaped response, so that nobody can use this endpoint to
    // discover which emails have accounts. The tell is a user with no identities
    // attached. Without this check the person is shown "check your email" and
    // waits for a confirmation link that is never sent.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      return { error: 'authError.emailExists', needsEmailConfirmation: false };
    }

    return { error: null, needsEmailConfirmation: !data.session };
  };

  const signOut = async () => {
    // Forget this device before dropping the session, not after. Deleting the
    // row is the one write its owner may do directly, and that policy needs
    // them to still be signed in — afterwards there is no auth left to do it
    // with, and the row would outlive the account that owns it.
    await unregisterPushNotifications();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ session, loading, signInWithPassword, signUpWithPassword, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
