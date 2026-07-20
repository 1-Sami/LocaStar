import {
  fetchCategories,
  fetchLocationById,
  fetchLocationCategoryIds,
  setLocationCategories,
  setLocationCreatorVisible,
  updateLocation,
  type Category,
} from '@locastar/shared';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
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
  const [creatorVisible, setCreatorVisible] = useState(true);
  const [creatorVisibleSaving, setCreatorVisibleSaving] = useState(false);

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
            setCreatorVisible(location.creator_visible);
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

  const handleToggleCreatorVisible = async (value: boolean) => {
    setCreatorVisible(value);
    setCreatorVisibleSaving(true);
    try {
      await setLocationCreatorVisible(supabase, id, value);
    } catch {
      setCreatorVisible(!value);
    } finally {
      setCreatorVisibleSaving(false);
    }
  };

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

          <View style={styles.visibilityRow}>
            <View style={styles.visibilityRowText}>
              <ThemedText type="default">Show me as the creator</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {creatorVisible
                  ? 'Your username shows as "Added by" on this listing.'
                  : 'Your name is hidden from this listing.'}
              </ThemedText>
            </View>
            <Switch
              value={creatorVisible}
              onValueChange={handleToggleCreatorVisible}
              disabled={creatorVisibleSaving}
              trackColor={{ true: Colors.light.primary }}
            />
          </View>

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
  visibilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  visibilityRowText: {
    flex: 1,
    gap: Spacing.half,
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
