import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PasswordInput } from '@/components/password-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { passwordProblem } from '@/constants/auth';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();

  const [exchanging, setExchanging] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fail = () => {
      if (!cancelled) {
        setLinkError('This reset link is invalid or has expired. Request a new one.');
        setExchanging(false);
      }
    };
    const succeed = () => {
      if (!cancelled) setExchanging(false);
    };

    // Supabase hands the recovery session back in one of two shapes depending
    // on the auth flow: PKCE puts a `?code=` in the query, while the implicit
    // flow (the client default here) puts the tokens in the URL *fragment*.
    // This screen only ever read `?code=`, so a real reset link reported
    // itself as expired. Accept both.
    if (code) {
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ error: exchangeError }) => (exchangeError ? fail() : succeed()))
        .catch(fail);
      return () => {
        cancelled = true;
      };
    }

    const fragment = typeof window !== 'undefined' ? window.location.hash : '';
    if (fragment) {
      const params = new URLSearchParams(fragment.replace(/^#/, ''));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (accessToken && refreshToken) {
        supabase.auth
          .setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ error: sessionError }) => (sessionError ? fail() : succeed()))
          .catch(fail);
        return () => {
          cancelled = true;
        };
      }
    }

    fail();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const problem = passwordProblem(password);
  const showPasswordProblem = password.length > 0 && problem !== null;
  const canSave = problem === null && !mismatch && !saving;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
  };

  if (saved) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle">Password updated</ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            Your password has been changed. You're now logged in.
          </ThemedText>
          <Pressable
            style={[styles.submitButton, { backgroundColor: theme.primary }]}
            onPress={() => router.replace('/')}>
            <ThemedText type="smallBold" style={styles.submitButtonText}>
              Continue
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (exchanging) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="default" themeColor="textSecondary">
            Verifying link…
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (linkError) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle">Link expired</ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            {linkError}
          </ThemedText>
          <Pressable
            style={[styles.submitButton, { backgroundColor: theme.primary }]}
            onPress={() => router.replace('/forgot-password' as never)}>
            <ThemedText type="smallBold" style={styles.submitButtonText}>
              Request a new link
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">Set a new password</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Choose a new password.
        </ThemedText>

        <PasswordInput
          value={password}
          onChangeText={setPassword}
          placeholder="New password"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />
        {showPasswordProblem && (
          <ThemedText type="small" style={styles.error}>
            {problem}
          </ThemedText>
        )}
        <PasswordInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Confirm new password"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />

        {mismatch && (
          <ThemedText type="small" style={styles.error}>
            Passwords don't match.
          </ThemedText>
        )}
        {error && (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        )}

        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          style={[styles.submitButton, { backgroundColor: theme.primary }, !canSave && styles.submitButtonDisabled]}>
          <ThemedText type="smallBold" style={styles.submitButtonText}>
            {saving ? 'Saving…' : 'Save new password'}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  input: {
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  error: {
    color: '#E85C4C',
  },
  submitButton: {
    height: 48,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#ffffff',
  },
});
