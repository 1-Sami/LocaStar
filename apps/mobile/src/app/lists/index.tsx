import { createList, fetchLists, type LocationList } from '@locastar/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

export default function MyListsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const theme = useTheme();

  const [lists, setLists] = useState<LocationList[]>([]);
  const [loading, setLoading] = useState(true);
  const [createVisible, setCreateVisible] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!session) return;
    setLoading(true);
    fetchLists(supabase, session.user.id)
      .then(setLists)
      .catch(() => setLists([]))
      .finally(() => setLoading(false));
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const handleCreate = async () => {
    if (!session || !name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await createList(supabase, session.user.id, name.trim(), description.trim() || null);
      setCreateVisible(false);
      setName('');
      setDescription('');
      reload();
    } catch {
      setError('Something went wrong creating the list. Try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        {loading ? (
          <ActivityIndicator style={styles.loadingIndicator} />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <Pressable style={styles.newListButton} onPress={() => setCreateVisible(true)}>
              <ThemedText type="smallBold" style={styles.newListButtonText}>
                + New list
              </ThemedText>
            </Pressable>

            {lists.length === 0 ? (
              <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
                No lists yet. Create one to start organizing places you love.
              </ThemedText>
            ) : (
              lists.map((list) => (
                <Pressable key={list.id} onPress={() => router.push({ pathname: '/lists/[id]', params: { id: list.id, name: list.name } })}>
                  <ThemedView type="backgroundElement" style={styles.card}>
                    <ThemedText type="smallBold">{list.name}</ThemedText>
                    {list.description && (
                      <ThemedText type="small" themeColor="textSecondary">
                        {list.description}
                      </ThemedText>
                    )}
                    <ThemedText type="small" themeColor="textSecondary">
                      {list.itemCount} {list.itemCount === 1 ? 'place' : 'places'}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      <Modal visible={createVisible} animationType="slide" transparent onRequestClose={() => setCreateVisible(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCreateVisible(false)} />
          <ThemedView type="backgroundElement" style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              New list
            </ThemedText>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="List name"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Description (optional)"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, styles.descriptionInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
              multiline
            />
            {error && (
              <ThemedText type="small" style={styles.errorText}>
                {error}
              </ThemedText>
            )}
            <Pressable
              style={[styles.createButton, (!name.trim() || creating) && styles.createButtonDisabled]}
              disabled={!name.trim() || creating}
              onPress={handleCreate}>
              <ThemedText type="smallBold" style={styles.createButtonText}>
                {creating ? 'Creating…' : 'Create list'}
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
    padding: Spacing.three,
    gap: Spacing.three,
  },
  newListButton: {
    height: 44,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14747A',
  },
  newListButtonText: {
    color: '#ffffff',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  card: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.half,
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
  },
  modalTitle: {
    fontSize: 20,
    lineHeight: 26,
    marginBottom: Spacing.two,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  descriptionInput: {
    height: 70,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#E05252',
  },
  createButton: {
    height: 48,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14747A',
    marginTop: Spacing.two,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#ffffff',
  },
});
