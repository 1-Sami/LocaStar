import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PasswordInput } from '@/components/password-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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
    if (!code) {
      setLinkError('This reset link is invalid or has expired. Request a new one.');
      setExchanging(false);
      return;
    }
    supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
      if (exchangeError) setLinkError('This reset link is invalid or has expired. Request a new one.');
      setExchanging(false);
    });
  }, [code]);

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const canSave = password.length >= 6 && !mismatch && !saving;

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
          Choose a new password (at least 6 characters).
        </ThemedText>

        <PasswordInput
          value={password}
          onChangeText={setPassword}
          placeholder="New password"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />
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
