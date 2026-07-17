import { fetchProfile, updateProfile } from '@locastar/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

export default function AccountInfoScreen() {
  const { session } = useAuth();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [emailChangePending, setEmailChangePending] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let cancelled = false;
      setLoading(true);
      setEmail(session.user.email ?? '');
      fetchProfile(supabase, session.user.id)
        .then((profile) => {
          if (cancelled) return;
          setUsername(profile.username ?? '');
          setBio(profile.bio ?? '');
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [session])
  );

  const handleSave = async () => {
    if (!session) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    setEmailChangePending(false);
    try {
      await updateProfile(supabase, session.user.id, {
        username: username.trim() || null,
        bio: bio.trim() || null,
      });

      const trimmedEmail = email.trim();
      if (trimmedEmail && trimmedEmail !== session.user.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email: trimmedEmail });
        if (emailError) throw emailError;
        setEmailChangePending(true);
      }

      setSaved(true);
    } catch {
      setError('Something went wrong saving your account info. Try again.');
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
              <ThemedText type="smallBold">Username</ThemedText>
              <TextInput
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  setSaved(false);
                }}
                placeholder="username"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="smallBold">Email</ThemedText>
              <TextInput
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setSaved(false);
                }}
                placeholder="you@example.com"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
                style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="smallBold">Bio</ThemedText>
              <TextInput
                value={bio}
                onChangeText={(text) => {
                  setBio(text);
                  setSaved(false);
                }}
                placeholder="Tell people a little about yourself"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, styles.bioInput, { color: theme.text, backgroundColor: theme.background }]}
                multiline
              />
            </View>
          </ThemedView>

          {error && (
            <ThemedText type="small" style={styles.errorText}>
              {error}
            </ThemedText>
          )}
          {saved && !error && (
            <ThemedText type="small" style={styles.savedText}>
              {emailChangePending ? 'Saved. Check your new email to confirm the change.' : 'Saved.'}
            </ThemedText>
          )}

          <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} disabled={saving} onPress={handleSave}>
            <ThemedText type="smallBold" style={styles.saveButtonText}>
              {saving ? 'Saving…' : 'Save changes'}
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
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
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
