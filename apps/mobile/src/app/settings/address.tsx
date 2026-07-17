import { fetchProfile, updateProfile } from '@locastar/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

export default function AddressScreen() {
  const { session } = useAuth();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let cancelled = false;
      setLoading(true);
      fetchProfile(supabase, session.user.id)
        .then((profile) => {
          if (!cancelled) setAddress(profile.home_address ?? '');
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
    try {
      await updateProfile(supabase, session.user.id, { home_address: address.trim() || null });
      setSaved(true);
    } catch {
      setError('Something went wrong saving your address. Try again.');
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
        <View style={styles.content}>
          <ThemedText type="small" themeColor="textSecondary">
            Used as a default starting point for nearby searches.
          </ThemedText>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Home address</ThemedText>
            <TextInput
              value={address}
              onChangeText={(text) => {
                setAddress(text);
                setSaved(false);
              }}
              placeholder="Home address"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
            />
          </ThemedView>

          {error && (
            <ThemedText type="small" style={styles.errorText}>
              {error}
            </ThemedText>
          )}
          {saved && !error && (
            <ThemedText type="small" style={styles.savedText}>
              Saved.
            </ThemedText>
          )}

          <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} disabled={saving} onPress={handleSave}>
            <ThemedText type="smallBold" style={styles.saveButtonText}>
              {saving ? 'Saving…' : 'Save address'}
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
  loadingIndicator: {
    marginTop: Spacing.six,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
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
    marginTop: Spacing.two,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#ffffff',
  },
});
