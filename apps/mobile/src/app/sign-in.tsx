import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PasswordInput } from '@/components/password-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/hooks/use-theme';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { signInWithPassword } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();

  const onSubmit = async () => {
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await signInWithPassword(email.trim(), password);
    setSubmitting(false);
    if (signInError) {
      setError(t(signInError));
      return;
    }
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">{t('auth.logIn')}</ThemedText>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={t('auth.email')}
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />
        <PasswordInput
          value={password}
          onChangeText={setPassword}
          placeholder={t('auth.password')}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />

        <Link href="/forgot-password" style={styles.forgotPasswordLink}>
          <ThemedText type="linkPrimary">{t('auth.forgotPassword')}</ThemedText>
        </Link>

        {error && (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        )}

        <Pressable
          onPress={onSubmit}
          disabled={submitting || !email || !password}
          style={[styles.submitButton, { backgroundColor: theme.primary }]}>
          <ThemedText type="smallBold" style={styles.submitButtonText}>
            {submitting ? t('auth.loggingIn') : t('auth.logIn')}
          </ThemedText>
        </Pressable>

        <View style={styles.switchRow}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('auth.noAccount')}
          </ThemedText>
          <Link href="/sign-up" replace>
            <ThemedText type="linkPrimary">{t('auth.signUp')}</ThemedText>
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
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginTop: -Spacing.two,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
});
