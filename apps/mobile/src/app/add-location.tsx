import { addLocationPhoto, fetchCategories, submitLocation, type Category, type LocationKind } from '@locastar/shared';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUserLocation } from '@/hooks/use-user-location';
import { useAuth } from '@/lib/auth-context';
import { pickImage, uploadImageToMedia } from '@/lib/media-upload';
import { supabase } from '@/lib/supabase';

export default function AddLocationScreen() {
  const { kind } = useLocalSearchParams<{ kind: LocationKind }>();
  const router = useRouter();
  const theme = useTheme();
  const { session } = useAuth();
  const { coords, loading: locationLoading } = useUserLocation();

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetchCategories(supabase)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const selectedCategoryLabel = categories
    .filter((c) => categoryIds.includes(c.id))
    .map((c) => c.name)
    .join(', ');
  const noun = kind === 'activity' ? 'activity' : 'place';

  const toggleCategory = (categoryId: string) => {
    setCategoryIds((current) =>
      current.includes(categoryId) ? current.filter((id) => id !== categoryId) : [...current, categoryId]
    );
  };

  const handlePickPhoto = async () => {
    const uri = await pickImage();
    if (uri) setPhotoUri(uri);
  };

  const handleSubmit = async () => {
    if (!session || !coords || !name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const locationId = await submitLocation(supabase, {
        kind: kind === 'activity' ? 'activity' : 'place',
        name: name.trim(),
        description: description.trim() || null,
        address: address.trim() || null,
        lat: coords.latitude,
        lng: coords.longitude,
        categoryIds,
        userId: session.user.id,
      });

      if (photoUri) {
        const path = `locations/${locationId}/${Date.now()}.jpg`;
        await uploadImageToMedia(path, photoUri);
        await addLocationPhoto(supabase, locationId, session.user.id, path);
      }

      setSubmitted(true);
    } catch {
      setError('Something went wrong submitting your ' + noun + '. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ title: kind === 'activity' ? 'Add activity' : 'Add location' }} />
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <View style={styles.confirmation}>
            <ThemedText type="subtitle" style={styles.confirmationTitle}>
              Thanks!
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.centerText}>
              Your {noun} is now live. Other users can find it right away.
            </ThemedText>
            <Pressable style={styles.submitButton} onPress={() => router.back()}>
              <ThemedText type="smallBold" style={styles.submitButtonText}>
                Done
              </ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: kind === 'activity' ? 'Add activity' : 'Add location' }} />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="small" themeColor="textSecondary">
            Your submission goes live immediately — you can report incorrect listings from their
            detail page.
          </ThemedText>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={kind === 'activity' ? 'Activity name' : 'Place name'}
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]}
          />

          <Pressable
            style={[styles.input, styles.categoryInput, { borderColor: theme.backgroundElement }]}
            onPress={() => setPickerVisible(true)}>
            <ThemedText type="default" themeColor={selectedCategoryLabel ? undefined : 'textSecondary'} numberOfLines={1}>
              {selectedCategoryLabel || 'Choose categories (optional)'}
            </ThemedText>
          </Pressable>

          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="Address (optional)"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]}
          />

          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Description (optional)"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, styles.bodyInput, { color: theme.text, borderColor: theme.backgroundElement }]}
            multiline
          />

          <View style={styles.photoRow}>
            {photoUri && <Image source={{ uri: photoUri }} style={styles.photoPreview} contentFit="cover" />}
            <Pressable
              style={[styles.input, styles.photoButton, { borderColor: theme.backgroundElement }]}
              onPress={handlePickPhoto}>
              <ThemedText type="default" themeColor="textSecondary">
                {photoUri ? 'Change photo' : 'Add a photo (optional)'}
              </ThemedText>
            </Pressable>
          </View>

          <ThemedText type="small" themeColor="textSecondary">
            {locationLoading
              ? 'Finding your location…'
              : "We'll pin this at your current location — you can refine it later."}
          </ThemedText>

          {error && (
            <ThemedText type="small" style={styles.errorText}>
              {error}
            </ThemedText>
          )}

          <Pressable
            style={[
              styles.submitButton,
              (!name.trim() || !coords || submitting) && styles.submitButtonDisabled,
            ]}
            disabled={!name.trim() || !coords || submitting}
            onPress={handleSubmit}>
            <ThemedText type="smallBold" style={styles.submitButtonText}>
              {submitting ? 'Submitting…' : `Submit ${noun}`}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={pickerVisible} animationType="slide" transparent onRequestClose={() => setPickerVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerVisible(false)}>
          <ThemedView type="backgroundElement" style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              Categories
            </ThemedText>
            <ScrollView>
              {categories.map((category) => (
                <Pressable key={category.id} style={styles.modalRow} onPress={() => toggleCategory(category.id)}>
                  <ThemedText type="default">{category.name}</ThemedText>
                  <ThemedText type="default">{categoryIds.includes(category.id) ? '✓' : ''}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.doneButton} onPress={() => setPickerVisible(false)}>
              <ThemedText type="smallBold" style={styles.submitButtonText}>
                Done
              </ThemedText>
            </Pressable>
          </ThemedView>
        </Pressable>
      </Modal>
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
  categoryInput: {
    justifyContent: 'center',
  },
  bodyInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  photoRow: {
    gap: Spacing.two,
  },
  photoPreview: {
    width: '100%',
    height: 160,
    borderRadius: Spacing.two,
  },
  photoButton: {
    alignItems: 'center',
  },
  errorText: {
    color: '#E05252',
  },
  submitButton: {
    height: 48,
    paddingHorizontal: Spacing.five,
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
  confirmation: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  confirmationTitle: {
    fontSize: 24,
    lineHeight: 30,
  },
  centerText: {
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    lineHeight: 26,
    marginBottom: Spacing.two,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  doneButton: {
    height: 44,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14747A',
    marginTop: Spacing.two,
  },
});
