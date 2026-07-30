import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PasswordInput } from '@/components/password-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { passwordProblem } from '@/constants/auth';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { usernameProblem } from '@/lib/username';
import { useTheme } from '@/hooks/use-theme';

// Deliberately loose — real validation is the confirmation email. This only
// catches obvious typos before submitting.
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;





export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { signUpWithPassword } = useAuth();
  const router = useRouter();
  const theme = useTheme();

  // Only complain once they've actually started typing, so the form doesn't
  // greet them with errors for fields they haven't filled in yet.
  const problem = passwordProblem(password);
  const showPasswordProblem = password.length > 0 && problem !== null;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const trimmedUsername = username.trim();
  const usernameIssue = usernameProblem(trimmedUsername);
  const showUsernameProblem = trimmedUsername.length > 0 && usernameIssue !== null;
  const emailLooksValid = EMAIL_PATTERN.test(email.trim());
  const showEmailProblem = email.trim().length > 0 && !emailLooksValid;
  const canSubmit =
    emailLooksValid && usernameIssue === null && problem === null && password === confirmPassword;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const { error: signUpError, needsEmailConfirmation } = await signUpWithPassword(
      email.trim(),
      password,
      trimmedUsername
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

        {showEmailProblem && (
          <ThemedText type="small" style={styles.error}>
            That doesn&apos;t look like an email address.
          </ThemedText>
        )}

        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="Username"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />
        <ThemedText type="small" themeColor="textSecondary">
          This is the name shown next to your reviews and the places you add. You can change it later.
        </ThemedText>

        {showUsernameProblem && (
          <ThemedText type="small" style={styles.error}>
            {usernameIssue}
          </ThemedText>
        )}

        <PasswordInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
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
