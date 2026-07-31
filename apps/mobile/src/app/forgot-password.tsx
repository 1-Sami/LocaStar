import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

/**
 * Where the reset link should land.
 *
 * This was hardcoded to `locastar://reset-password`, the native deep-link
 * scheme. Reset emails get opened wherever the person reads their mail —
 * usually a desktop or webmail browser — and a browser has no handler for
 * `locastar://`, so the link silently did nothing. Only the https address
 * works everywhere; on a phone with the app installed the OS can still hand
 * it to the app.
 */
function resetRedirectTo(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/reset-password`;
  }
  return 'https://locastar.se/reset-password';
}

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSubmit = async () => {
    setSubmitting(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: resetRedirectTo(),
    });
    setSubmitting(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle">Check your email</ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            If an account exists for {email}, we've sent a link to reset your password.
          </ThemedText>
          <Pressable style={[styles.submitButton, { backgroundColor: theme.primary }]} onPress={() => router.back()}>
            <ThemedText type="smallBold" style={styles.submitButtonText}>
              Back to log in
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">Reset password</ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Enter your email and we'll send you a link to reset your password.
        </ThemedText>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />

        {error && (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        )}

        <Pressable
          onPress={onSubmit}
          disabled={submitting || !email.trim()}
          style={[
            styles.submitButton,
            { backgroundColor: theme.primary },
            (submitting || !email.trim()) && styles.submitButtonDisabled,
          ]}>
          <ThemedText type="smallBold" style={styles.submitButtonText}>
            {submitting ? 'Sending…' : 'Send reset link'}
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
