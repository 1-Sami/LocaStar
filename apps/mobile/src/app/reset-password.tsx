import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PasswordInput } from '@/components/password-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { passwordProblem } from '@/constants/auth';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { APP_SCHEME_URL } from '@/lib/auth-redirect';
import { authErrorKey } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();

  const [exchanging, setExchanging] = useState(true);
  /*
   * Whether the link was usable, not the sentence saying so.
   *
   * Storing the translated text meant the effect that validates the link
   * depended on t, and adding t to its dependencies would re-run the whole
   * session exchange every time the language changed. Keeping the fact here
   * and translating at render also means the message follows a language
   * switch, which a stored string would not.
   */
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fail = () => {
      if (!cancelled) {
        setLinkInvalid(true);
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
      setError(t(authErrorKey(updateError)));
      return;
    }
    setSaved(true);
  };

  if (saved) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle">{t('resetPassword.updatedTitle')}</ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            {t('resetPassword.updatedBody')}
          </ThemedText>
          {/*
            Reset links are read wherever mail is read, so this page is usually
            reached in a browser — and `router.replace('/')` there meant the
            website's home page. The reset worked and the person was simply left
            on the website wondering what had happened. /auth/confirmed already
            solved this; the same handoff belongs here.

            Not fired automatically, for the reason given there: on a desktop, or
            a phone without the app installed, an unhandled scheme throws a
            browser error dialog. A button press is a choice.
          */}
          <Pressable
            style={[styles.submitButton, { backgroundColor: theme.primary }]}
            onPress={() => {
              if (Platform.OS === 'web') window.location.href = APP_SCHEME_URL;
              else router.replace('/');
            }}>
            <ThemedText type="smallBold" style={styles.submitButtonText}>
              {Platform.OS === 'web' ? 'Open LocaStar' : 'Continue'}
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
            {t('resetPassword.verifying')}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (linkInvalid) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle">{t('resetPassword.linkExpired')}</ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            {t('resetPassword.invalidLink')}
          </ThemedText>
          <Pressable
            style={[styles.submitButton, { backgroundColor: theme.primary }]}
            onPress={() => router.replace('/forgot-password' as never)}>
            <ThemedText type="smallBold" style={styles.submitButtonText}>
              {t('resetPassword.requestNewLink')}
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">{t('resetPassword.setNewPassword')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('resetPassword.chooseNew')}
        </ThemedText>

        <PasswordInput
          value={password}
          onChangeText={setPassword}
          placeholder={t('settings.newPassword')}
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
          placeholder={t('settings.confirmNewPassword')}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />

        {mismatch && (
          <ThemedText type="small" style={styles.error}>
            {t('settings.passwordsDontMatch')}
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
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#ffffff',
  },
});
