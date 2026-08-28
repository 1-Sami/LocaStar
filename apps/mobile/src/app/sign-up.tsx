import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PasswordInput } from '@/components/password-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { emailTypoSuggestion, passwordProblem } from '@/constants/auth';
import { MaxContentWidth, Spacing } from '@/constants/theme';
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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { signUpWithPassword } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();

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
  // A domain that cannot exist blocks submitting rather than just warning. The
  // account would be created and the confirmation mail would hard bounce, which
  // leaves someone locked out with nothing on screen to explain it.
  const typoSuggestion = emailLooksValid ? emailTypoSuggestion(email) : null;
  const canSubmit =
    emailLooksValid &&
    typoSuggestion === null &&
    usernameIssue === null &&
    problem === null &&
    password === confirmPassword &&
    // Ticking the box is part of being able to submit, not a warning after the
    // fact: App Review wants the terms agreed to before an account exists, and
    // a link somebody may or may not have opened does not evidence that.
    acceptedTerms;

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
      setError(t(signUpError));
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
          <ThemedText type="subtitle">{t('auth.checkYourEmail')}</ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            {t('auth.confirmationSent', { email })}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">{t('auth.signUp')}</ThemedText>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={t('auth.email')}
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />

        {showEmailProblem && (
          <ThemedText type="small" style={styles.error}>
            {t('auth.emailInvalid')}
          </ThemedText>
        )}

        {/* Tappable, because retyping the whole address to fix one letter is
            how people give up. */}
        {typoSuggestion && (
          <Pressable onPress={() => setEmail(typoSuggestion)}>
            <ThemedText type="small" style={styles.error}>
              {t('auth.emailTypo', { suggestion: typoSuggestion })}
            </ThemedText>
          </Pressable>
        )}

        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder={t('auth.username')}
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {t('auth.usernameHint')}
        </ThemedText>

        {showUsernameProblem && (
          <ThemedText type="small" style={styles.error}>
            {t(usernameIssue.key, usernameIssue.params)}
          </ThemedText>
        )}

        <PasswordInput
          value={password}
          onChangeText={setPassword}
          placeholder={t('auth.password')}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />

        {showPasswordProblem && (
          <ThemedText type="small" style={styles.error}>
            {t(problem.key, problem.params)}
          </ThemedText>
        )}

        <PasswordInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder={t('auth.repeatPassword')}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />

        {passwordsMismatch && (
          <ThemedText type="small" style={styles.error}>
            {t('auth.passwordsDontMatch')}
          </ThemedText>
        )}

        {error && (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        )}

        {/* Above the button, not below it: this has to be read before the
            account is made, and the three keys are split because two links sit
            inside the sentence. Swedish needs "våra ... och vår ..." where
            English has "our ... and ...", so the joining words have to be
            translatable separately — one string with placeholders could not
            carry the links.

            The box is the whole row, so the label is part of the tap target
            rather than a 20pt square somebody has to hit exactly. The links
            still open, because a Link inside a Pressable takes the touch. */}
        <Pressable
          style={styles.consentRow}
          onPress={() => setAcceptedTerms((accepted) => !accepted)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: acceptedTerms }}>
          <View
            style={[
              styles.checkbox,
              { borderColor: acceptedTerms ? theme.primary : theme.fieldBorder },
              acceptedTerms && { backgroundColor: theme.primary },
            ]}>
            {acceptedTerms && <Ionicons name="checkmark" size={14} color="#ffffff" />}
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.consentText}>
            {/* First person, because a ticked box is a statement the person is
                making. Sign-in keeps the passive "By logging in you agree",
                which is the accurate thing to say where there is no box. */}
            {t('auth.consentCheckboxBefore')}
            <Link href={'/legal/terms' as never}>
              <ThemedText type="linkPrimary">{t('nav.termsOfService')}</ThemedText>
            </Link>
            {t('auth.consentBetween')}
            <Link href={'/legal/privacy' as never}>
              <ThemedText type="linkPrimary">{t('nav.privacyPolicy')}</ThemedText>
            </Link>
            {t('auth.consentAfter')}
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={onSubmit}
          disabled={submitting || !canSubmit}
          style={[
            styles.submitButton,
            { backgroundColor: theme.primary },
            (submitting || !canSubmit) && styles.submitButtonDisabled,
          ]}>
          <ThemedText type="smallBold" style={styles.submitButtonText}>
            {submitting ? t('auth.signingUp') : t('auth.signUp')}
          </ThemedText>
        </Pressable>

        <View style={styles.switchRow}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('auth.alreadyHaveAccount')}
          </ThemedText>
          <Link href="/sign-in" replace>
            <ThemedText type="linkPrimary">{t('auth.logIn')}</ThemedText>
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
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
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
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Spacing.half,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    // Nudged down so it sits on the first line of the sentence rather than
    // above it, since the text wraps to two or three lines.
    marginTop: 1,
  },
  consentText: {
    flex: 1,
    lineHeight: 20,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
});
