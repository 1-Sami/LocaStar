import { fetchProfile, updateProfile } from '@locastar/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PasswordInput } from '@/components/password-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authErrorKey } from '@/lib/auth-errors';
import { authRedirectTo } from '@/lib/auth-redirect';
import { useAuth } from '@/lib/auth-context';
import { writeFailureMessage } from '@/lib/restriction';
import { verifyCurrentPassword } from '@/lib/reauth';
import { usernameProblem } from '@/lib/username';
import { supabase } from '@/lib/supabase';

export default function AccountInfoScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [emailChangePending, setEmailChangePending] = useState(false);

  const [loadFailed, setLoadFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let cancelled = false;
      setLoading(true);
      setLoadFailed(false);
      setEmail(session.user.email ?? '');
      fetchProfile(supabase, session.user.id)
        .then((profile) => {
          if (cancelled) return;
          setUsername(profile.username ?? '');
        })
        .catch((err) => {
          /*
           * Swallowing this blanked people's usernames.
           *
           * The field stays empty when the profile never arrives, and the
           * username rules are only checked on a non-empty string — so Save
           * sent `username: null` and the handle was gone. Proved against the
           * live database with a rolled-back probe: nothing else stops that
           * write. Saving is now blocked until we know what we are editing.
           */
          console.error('Failed to load your profile', err);
          if (!cancelled) setLoadFailed(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [session])
  );

  const trimmedEmail = email.trim();
  const emailChanged = Boolean(trimmedEmail) && trimmedEmail !== (session?.user.email ?? '');
  // Same rule as sign-up and the database constraint, so a bad handle is
  // caught here rather than coming back as a raw constraint violation.
  const trimmedUsername = username.trim();
  const usernameIssue = trimmedUsername.length > 0 ? usernameProblem(trimmedUsername) : null;

  const handleSave = async () => {
    if (!session) return;
    // Nothing loaded means the fields are empty by accident, not by intent.
    if (loadFailed) {
      setError(t('common.somethingWentWrong'));
      return;
    }
    setError(null);
    setSaved(false);
    setEmailChangePending(false);

    // Changing the account email is a takeover vector, so make sure whoever is
    // holding the phone actually knows the password before allowing it.
    if (usernameIssue) {
      setError(t(usernameIssue.key, usernameIssue.params));
      return;
    }

    if (emailChanged && !currentPassword) {
      setError(t('settings.accountReauth'));
      return;
    }

    setSaving(true);

    if (emailChanged) {
      const confirmed = await verifyCurrentPassword(session.user.email ?? '', currentPassword);
      if (!confirmed) {
        setError(t('settings.wrongPassword'));
        setSaving(false);
        return;
      }
    }

    try {
      await updateProfile(supabase, session.user.id, {
        username: username.trim() || null,
      });

      if (emailChanged) {
        const { error: emailError } = await supabase.auth.updateUser(
          { email: trimmedEmail },
          { emailRedirectTo: authRedirectTo('/auth/confirmed') }
        );
        /*
         * Reported specifically rather than thrown into the catch below.
         *
         * Every reason this fails is one the person can act on — the address
         * belongs to someone else, it is malformed, too many confirmation mails
         * have gone out already — and the catch answers all of them with "we
         * couldn't save your account". Somebody typing in an address their
         * partner already registered would be told nothing at all, and would
         * try again.
         */
        if (emailError) {
          setError(t(authErrorKey(emailError)));
          setSaving(false);
          return;
        }
        setEmailChangePending(true);
        setCurrentPassword('');
      }

      setSaved(true);
    } catch {
      setError(
        await writeFailureMessage(
          session.user.id,
          t('validation.accountSaveFailed'),
          t
        )
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <ActivityIndicator style={styles.loadingIndicator} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.field}>
              <ThemedText type="smallBold">{t('settings.username')}</ThemedText>
              <TextInput
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  setSaved(false);
                }}
                placeholder={t('settings.username').toLowerCase()}
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="smallBold">{t('settings.email')}</ThemedText>
              <TextInput
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setSaved(false);
                }}
                placeholder={t('settings.emailPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
                style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
              />
            </View>

            {emailChanged && (
              <View style={styles.field}>
                <ThemedText type="smallBold">{t('settings.currentPassword')}</ThemedText>
                <PasswordInput
                  value={currentPassword}
                  onChangeText={(text) => {
                    setCurrentPassword(text);
                    setSaved(false);
                  }}
                  placeholder={t('settings.currentPassword')}
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
                />
                <ThemedText type="small" themeColor="textSecondary">
                  {t('settings.currentPasswordHint')}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('settings.emailChangeHint')}
                </ThemedText>
              </View>
            )}

          </ThemedView>

          {error && (
            <ThemedText type="small" style={styles.errorText}>
              {error}
            </ThemedText>
          )}
          {saved && !error && (
            <ThemedText type="small" style={styles.savedText}>
              {emailChangePending
                ? t('settings.accountSavedEmailPending')
                : t('settings.accountSaved')}
            </ThemedText>
          )}

          <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} disabled={saving} onPress={handleSave}>
            <ThemedText type="smallBold" style={styles.saveButtonText}>
              {saving ? t('settings.saving') : t('settings.saveChanges')}
            </ThemedText>
          </Pressable>
        </ScrollView>
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
  },
  loadingIndicator: {
    marginTop: Spacing.six,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  errorText: {
    color: '#E05252',
  },
  savedText: {
    color: '#4CD37A',
  },
  saveButton: {
    height: 48,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14747A',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#ffffff',
  },
});
