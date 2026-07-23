import { addReviewPhoto, submitReview } from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhotoPicker } from '@/components/photo-picker';
import { STAR_COLOR } from '@/components/star-rating';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { uploadImageToMedia } from '@/lib/media-upload';
import { supabase } from '@/lib/supabase';

function StarPicker({ value, onChange }: { value: number; onChange: (rating: number) => void }) {
  return (
    <View style={styles.starPickerRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={6}>
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={36} color={STAR_COLOR} />
        </Pressable>
      ))}
    </View>
  );
}

export default function WriteReviewScreen() {
  const { locationId, locationName, rating, title, body } = useLocalSearchParams<{
    locationId: string;
    locationName?: string;
    rating?: string;
    title?: string;
    body?: string;
  }>();
  const router = useRouter();
  const { session } = useAuth();
  const theme = useTheme();

  const [ratingValue, setRatingValue] = useState(rating ? Number(rating) : 0);
  const [titleValue, setTitleValue] = useState(title ?? '');
  const [bodyValue, setBodyValue] = useState(body ?? '');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!session || ratingValue === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const reviewId = await submitReview(supabase, {
        locationId,
        userId: session.user.id,
        rating: ratingValue,
        title: titleValue.trim() || null,
        body: bodyValue.trim() || null,
      });

      for (const uri of photoUris) {
        const path = `reviews/${reviewId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        await uploadImageToMedia(path, uri);
        await addReviewPhoto(supabase, reviewId, path);
      }

      router.back();
    } catch (err) {
      console.error('Failed to submit review', err);
      setError('Something went wrong submitting your review. Try again.');
      setSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          {locationName && (
            <ThemedText type="small" themeColor="textSecondary">
              Reviewing {locationName}
            </ThemedText>
          )}

          <StarPicker value={ratingValue} onChange={setRatingValue} />

          <TextInput
            value={titleValue}
            onChangeText={setTitleValue}
            placeholder="Title (optional)"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]}
          />
          <TextInput
            value={bodyValue}
            onChangeText={setBodyValue}
            placeholder="Share details about your visit (optional)"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, styles.bodyInput, { color: theme.text, borderColor: theme.backgroundElement }]}
            multiline
          />

          <ThemedText type="smallBold" style={styles.photoLabel}>
            Add photos (optional)
          </ThemedText>
          <PhotoPicker uris={photoUris} onChange={setPhotoUris} />

          {error && (
            <ThemedText type="small" style={styles.errorText}>
              {error}
            </ThemedText>
          )}

          <Pressable
            style={[styles.submitButton, (ratingValue === 0 || submitting) && styles.submitButtonDisabled]}
            disabled={ratingValue === 0 || submitting}
            onPress={handleSubmit}>
            <ThemedText type="smallBold" style={styles.submitButtonText}>
              {submitting ? 'Submitting…' : 'Submit review'}
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
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  photoLabel: {
    marginTop: -Spacing.one,
  },
  starPickerRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginVertical: Spacing.two,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  bodyInput: {
    height: 120,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#E05252',
  },
  submitButton: {
    height: 48,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14747A',
    marginTop: Spacing.two,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#ffffff',
  },
});
