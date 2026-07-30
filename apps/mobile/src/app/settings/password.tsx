import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PasswordInput } from '@/components/password-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { passwordProblem } from '@/constants/auth';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { verifyCurrentPassword } from '@/lib/reauth';
import { supabase } from '@/lib/supabase';

export default function ChangePasswordScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const problem = passwordProblem(password);
  const showPasswordProblem = password.length > 0 && problem !== null;
  const canSave = currentPassword.length > 0 && problem === null && !mismatch && !saving;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    // Anyone holding an unlocked phone could otherwise take over the account
    // outright, so prove they know the existing password first.
    const confirmed = await verifyCurrentPassword(session?.user.email ?? '', currentPassword);
    if (!confirmed) {
      setError('That password is incorrect.');
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
    setCurrentPassword('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.content}>
          <ThemedText type="small" themeColor="textSecondary">
            Confirm your current password, then choose a new one.
          </ThemedText>

          <PasswordInput
            value={currentPassword}
            onChangeText={(text) => {
              setCurrentPassword(text);
              setSaved(false);
              setError(null);
            }}
            placeholder="Current password"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]}
          />

          <PasswordInput
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setSaved(false);
            }}
            placeholder="New password"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]}
          />
          {showPasswordProblem && (
            <ThemedText type="small" style={styles.errorText}>
              {problem}
            </ThemedText>
          )}
          <PasswordInput
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setSaved(false);
            }}
            placeholder="Confirm new password"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]}
          />

          {mismatch && (
            <ThemedText type="small" style={styles.errorText}>
              Passwords don't match.
            </ThemedText>
          )}
          {error && (
            <ThemedText type="small" style={styles.errorText}>
              {error}
            </ThemedText>
          )}
          {saved && !error && (
            <ThemedText type="small" style={styles.savedText}>
              Password updated.
            </ThemedText>
          )}

          <Pressable style={[styles.saveButton, !canSave && styles.saveButtonDisabled]} disabled={!canSave} onPress={handleSave}>
            <ThemedText type="smallBold" style={styles.saveButtonText}>
              {saving ? 'Saving…' : 'Save password'}
            </ThemedText>
          </Pressable>
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
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
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
    marginTop: Spacing.two,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#ffffff',
  },
});
