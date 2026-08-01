import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SUPPORT_EMAIL } from '@/constants/support';
import { Spacing } from '@/constants/theme';
import { fetchProfile } from '@locastar/shared';

import { useAuth } from '@/lib/auth-context';
import { confirmAsync } from '@/lib/confirm';
import { removeAvatarFile } from '@/lib/media-upload';
import { supabase } from '@/lib/supabase';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    const confirmed = await confirmAsync(
      'Delete your account?',
      'This permanently deletes your profile, favorites, lists and friends. Reviews, photos and places you added stay in the app with your name removed. This cannot be undone.',
      'Delete account'
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      // The avatar is a picture of a person, so it goes rather than being
      // orphaned. It has to happen here, before the account disappears:
      // Supabase refuses direct deletes against storage.objects, so the SQL
      // function cannot do it (migration 0073).
      if (session) {
        const profile = await fetchProfile(supabase, session.user.id).catch(() => null);
        await removeAvatarFile(profile?.avatar_url ?? null);
      }

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
            This permanently deletes your profile, username, profile picture, home address, favorites,
            bucket list, shared locations, lists and friends. There is no way to undo this.
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            Reviews, photos and places you added stay in the app with your name removed, so the places
            other people rely on don&apos;t lose their ratings. They can no longer be traced back to
            you. If you want something you posted deleted rather than unlinked, email {SUPPORT_EMAIL}.
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
