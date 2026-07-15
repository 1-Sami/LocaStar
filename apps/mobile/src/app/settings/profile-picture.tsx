import { fetchProfile, updateProfile } from '@locastar/shared';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { pickImage, uploadImageToMedia } from '@/lib/media-upload';
import { supabase } from '@/lib/supabase';

export default function ProfilePictureScreen() {
  const { session } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
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
    try {
      const path = `avatars/${session.user.id}-${Date.now()}.jpg`;
      const publicUrl = await uploadImageToMedia(path, uri);
      await updateProfile(supabase, session.user.id, { avatar_url: publicUrl });
      setAvatarUrl(publicUrl);
    } catch {
      setError('Something went wrong uploading your photo. Try again.');
    } finally {
      setUploading(false);
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
          <Image
            source={{ uri: avatarUrl ?? `https://picsum.photos/seed/${session?.user.id}/200/200` }}
            style={styles.avatar}
          />

          {error && (
            <ThemedText type="small" style={styles.errorText}>
              {error}
            </ThemedText>
          )}

          <Pressable style={[styles.button, uploading && styles.buttonDisabled]} disabled={uploading} onPress={handlePickImage}>
            <ThemedText type="smallBold" style={styles.buttonText}>
              {uploading ? 'Uploading…' : 'Choose a photo'}
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    paddingHorizontal: Spacing.five,
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
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
});
