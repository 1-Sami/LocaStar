import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PasswordInput } from '@/components/password-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function ChangePasswordScreen() {
  const theme = useTheme();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const canSave = password.length >= 6 && !mismatch && !saving;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.content}>
          <ThemedText type="small" themeColor="textSecondary">
            Choose a new password (at least 6 characters).
          </ThemedText>

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
