import { fetchProfile, updateProfile } from '@locastar/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { confirmAsync } from '@/lib/confirm';
import { pickImage, uploadImageToMedia } from '@/lib/media-upload';
import { useSharedProfile } from '@/lib/profile-context';
import { supabase } from '@/lib/supabase';

/**
 * Recovers the storage path from a public URL so the file itself can be
 * deleted. "Remove" that only cleared the profile field would leave the photo
 * sitting at a public URL, which isn't what removing a picture should mean.
 */
function storagePathFromPublicUrl(url: string): string | null {
  const marker = '/object/public/media/';
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}

export default function ProfilePictureScreen() {
  const { session } = useAuth();
  const { refreshProfile } = useSharedProfile();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let cancelled = false;
      setLoading(true);
      fetchProfile(supabase, session.user.id)
        .then((profile) => {
          if (!cancelled) setAvatarUrl(profile.avatar_url);
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

  const handlePickImage = async () => {
    if (!session) return;
    setError(null);
    const uri = await pickImage();
    if (!uri) return;

    setUploading(true);
    const previousUrl = avatarUrl;
    try {
      const path = `avatars/${session.user.id}-${Date.now()}.jpg`;
      const publicUrl = await uploadImageToMedia(path, uri);
      await updateProfile(supabase, session.user.id, { avatar_url: publicUrl });
      setAvatarUrl(publicUrl);
      refreshProfile();

      // Each upload used a fresh timestamped path and nothing removed the old
      // one, so every change left the previous picture readable at its public
      // URL. Clean it up once the new one is safely in place — best effort,
      // since the change itself has already succeeded.
      const previousPath = previousUrl ? storagePathFromPublicUrl(previousUrl) : null;
      if (previousPath && previousPath !== path) {
        const { error: removeError } = await supabase.storage.from('media').remove([previousPath]);
        if (removeError) console.error('Could not delete the previous avatar', removeError);
      }
    } catch {
      setError('Something went wrong uploading your photo. Try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!session || !avatarUrl) return;
    const confirmed = await confirmAsync(
      'Remove your profile picture?',
      "Your photo is deleted and you'll show up with the default picture instead. You can add a new one any time.",
      'Remove'
    );
    if (!confirmed) return;

    setError(null);
    setRemoving(true);
    try {
      await updateProfile(supabase, session.user.id, { avatar_url: null });

      // storage.remove() resolves with an { error } rather than throwing, so
      // an unchecked call reports success even when the file is still sitting
      // at a public URL. The profile change has already landed, so don't fail
      // the whole action — say the picture is gone from the app but the file
      // wasn't deleted.
      const path = storagePathFromPublicUrl(avatarUrl);
      if (path) {
        const { error: removeError } = await supabase.storage.from('media').remove([path]);
        if (removeError) {
          console.error('Avatar file delete failed', removeError);
          setError(
            "Your picture was removed from your profile, but the file couldn't be deleted. Try removing it again."
          );
        }
      }

      setAvatarUrl(null);
      refreshProfile();
    } catch {
      setError('Something went wrong removing your photo. Try again.');
    } finally {
      setRemoving(false);
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
          <Avatar url={avatarUrl} size={140} />

          {!avatarUrl && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              You haven&apos;t added a photo yet.
            </ThemedText>
          )}

          {error && (
            <ThemedText type="small" style={styles.errorText}>
              {error}
            </ThemedText>
          )}

          <Pressable
            style={[styles.button, (uploading || removing) && styles.buttonDisabled]}
            disabled={uploading || removing}
            onPress={handlePickImage}>
            <ThemedText type="smallBold" style={styles.buttonText}>
              {uploading ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Choose a photo'}
            </ThemedText>
          </Pressable>

          {avatarUrl && (
            <Pressable
              style={[styles.removeButton, (uploading || removing) && styles.buttonDisabled]}
              disabled={uploading || removing}
              onPress={handleRemoveImage}>
              <ThemedText type="smallBold" style={styles.removeButtonText}>
                {removing ? 'Removing…' : 'Remove photo'}
              </ThemedText>
            </Pressable>
          )}
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    paddingHorizontal: Spacing.five,
  },
  centerText: {
    textAlign: 'center',
  },
  errorText: {
    color: '#E05252',
  },
  button: {
    height: 48,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14747A',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#ffffff',
  },
  removeButton: {
    height: 48,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E05252',
  },
  removeButtonText: {
    color: '#E05252',
  },
});
