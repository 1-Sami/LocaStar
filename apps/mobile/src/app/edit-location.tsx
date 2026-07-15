import {
  fetchCategories,
  fetchLocationById,
  fetchLocationCategoryIds,
  setLocationCategories,
  updateLocation,
  type Category,
} from '@locastar/shared';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function EditLocationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let cancelled = false;
      setLoading(true);
      Promise.all([fetchLocationById(supabase, id), fetchLocationCategoryIds(supabase, id), fetchCategories(supabase)])
        .then(([location, existingCategoryIds, categoriesResult]) => {
          if (cancelled) return;
          setCategories(categoriesResult);
          if (location) {
            setName(location.name);
            setDescription(location.description ?? '');
            setAddress(location.address ?? '');
          }
          setCategoryIds(existingCategoryIds);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [id])
  );

  const selectedCategoryLabel = categories
    .filter((c) => categoryIds.includes(c.id))
    .map((c) => c.name)
    .join(', ');

  const toggleCategory = (categoryId: string) => {
    setCategoryIds((current) =>
      current.includes(categoryId) ? current.filter((c) => c !== categoryId) : [...current, categoryId]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      await updateLocation(supabase, id, {
        name: name.trim(),
        description: description.trim() || null,
        address: address.trim() || null,
      });
      await setLocationCategories(supabase, id, categoryIds);
      setSaved(true);
    } catch {
      setError('Something went wrong saving your changes. Try again.');
    } finally {
      setSubmitting(false);
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
          <TextInput
            value={name}
            onChangeText={(text) => {
              setName(text);
              setSaved(false);
            }}
            placeholder="Name"
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
            onChangeText={(text) => {
              setAddress(text);
              setSaved(false);
            }}
            placeholder="Address (optional)"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]}
          />

          <TextInput
            value={description}
            onChangeText={(text) => {
              setDescription(text);
              setSaved(false);
            }}
            placeholder="Description (optional)"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, styles.bodyInput, { color: theme.text, borderColor: theme.backgroundElement }]}
            multiline
          />

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

          <Pressable
            style={[styles.saveButton, (!name.trim() || submitting) && styles.saveButtonDisabled]}
            disabled={!name.trim() || submitting}
            onPress={handleSave}>
            <ThemedText type="smallBold" style={styles.saveButtonText}>
              {submitting ? 'Saving…' : 'Save changes'}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={pickerVisible} animationType="slide" transparent onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPickerVisible(false)} />
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
              <ThemedText type="smallBold" style={styles.saveButtonText}>
                Done
              </ThemedText>
            </Pressable>
          </ThemedView>
        </View>
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
  loadingIndicator: {
    marginTop: Spacing.six,
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
  modalRoot: {
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
