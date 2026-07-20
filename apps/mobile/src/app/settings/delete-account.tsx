import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { confirmAsync } from '@/lib/confirm';
import { supabase } from '@/lib/supabase';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    const confirmed = await confirmAsync(
      'Delete your account?',
      'This permanently deletes your profile, reviews, favorites, lists, and everything else tied to your account. This cannot be undone.',
      'Delete account'
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('delete_own_account');
      if (rpcError) throw rpcError;
      await signOut();
      router.replace('/');
    } catch {
      setError('Something went wrong deleting your account. Try again.');
      setDeleting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Delete account' }} />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.content}>
          <ThemedText type="subtitle" style={styles.title}>
            Delete your account
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            This permanently deletes your profile, reviews, favorites, bucket list, shared
            locations, and lists. There is no way to undo this.
          </ThemedText>

          {error && (
            <ThemedText type="small" style={styles.errorText}>
              {error}
            </ThemedText>
          )}

          <Pressable
            style={[styles.deleteButton, deleting && styles.deleteButtonDisabled]}
            disabled={deleting}
            onPress={handleDelete}>
            {deleting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <ThemedText type="smallBold" style={styles.deleteButtonText}>
                Delete my account
              </ThemedText>
            )}
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
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
  },
  errorText: {
    color: '#E05252',
  },
  deleteButton: {
    height: 36,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E05252',
    marginTop: Spacing.two,
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    color: '#ffffff',
  },
});
