import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PasswordInput } from '@/components/password-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MIN_PASSWORD_LENGTH } from '@/constants/auth';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/hooks/use-theme';





export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { signUpWithPassword } = useAuth();
  const router = useRouter();
  const theme = useTheme();

  // Only complain once they've actually started typing the second one, so the
  // form doesn't show an error before there's anything to compare.
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const canSubmit =
    Boolean(email.trim()) && password.length >= MIN_PASSWORD_LENGTH && password === confirmPassword;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const { error: signUpError, needsEmailConfirmation } = await signUpWithPassword(
      email.trim(),
      password
    );
    setSubmitting(false);
    if (signUpError) {
      setError(signUpError);
      return;
    }
    if (needsEmailConfirmation) {
      setConfirmationSent(true);
      return;
    }
    router.back();
  };

  if (confirmationSent) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle">Check your email</ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            We sent a confirmation link to {email}. Follow it to finish creating your account,
            then come back and log in.
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">Sign up</ThemedText>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />
        <PasswordInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password (min. 8 characters, letters and digits)"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />
        <PasswordInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Repeat password"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />

        {passwordsMismatch && (
          <ThemedText type="small" style={styles.error}>
            The two passwords don&apos;t match.
          </ThemedText>
        )}

        {error && (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        )}

        <Pressable
          onPress={onSubmit}
          disabled={submitting || !canSubmit}
          style={[styles.submitButton, { backgroundColor: theme.primary }]}>
          <ThemedText type="smallBold" style={styles.submitButtonText}>
            {submitting ? 'Signing up...' : 'Sign up'}
          </ThemedText>
        </Pressable>

        <ThemedText type="small" themeColor="textSecondary" style={styles.consentText}>
          By signing up you agree to our{' '}
          <Link href={'/legal/terms' as never}>
            <ThemedText type="linkPrimary">Terms of Service</ThemedText>
          </Link>{' '}
          and{' '}
          <Link href={'/legal/privacy' as never}>
            <ThemedText type="linkPrimary">Privacy Policy</ThemedText>
          </Link>
          .
        </ThemedText>

        <View style={styles.switchRow}>
          <ThemedText type="small" themeColor="textSecondary">
            Already have an account?
          </ThemedText>
          <Link href="/sign-in" replace>
            <ThemedText type="linkPrimary">Log in</ThemedText>
          </Link>
        </View>
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
  submitButtonText: {
    color: '#ffffff',
  },
  consentText: {
    textAlign: 'center',
    lineHeight: 20,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
});
