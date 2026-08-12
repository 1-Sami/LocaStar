import { createList, fetchLists, fetchProfile, setListLiked, type LocationList } from '@locastar/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListCard } from '@/components/list-card';
import { SheetRoot } from '@/components/sheet-root';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { writeFailureMessage } from '@/lib/restriction';
import { supabase } from '@/lib/supabase';

export default function MyListsScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const router = useRouter();
  const theme = useTheme();

  const [lists, setLists] = useState<LocationList[]>([]);
  const [username, setUsername] = useState('you');
  const [loading, setLoading] = useState(true);
  const [createVisible, setCreateVisible] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!session) return;
    setLoading(true);
    Promise.all([fetchLists(supabase, session.user.id), fetchProfile(supabase, session.user.id).catch(() => null)])
      .then(([listRows, profile]) => {
        setLists(listRows);
        setUsername(profile?.username ?? profile?.display_name ?? 'you');
      })
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
      await createList(supabase, session.user.id, name.trim(), description.trim() || null, isPublic);
      setCreateVisible(false);
      setName('');
      setDescription('');
      setIsPublic(false);
      reload();
    } catch {
      setError(
        await writeFailureMessage(session.user.id, 'Something went wrong creating the list. Try again.')
      );
    } finally {
      setCreating(false);
    }
  };

  const handleToggleLike = async (list: LocationList) => {
    if (!session) return;
    const nextLiked = !list.likedByMe;
    setLists((current) =>
      current.map((item) =>
        item.id === list.id
          ? { ...item, likedByMe: nextLiked, likeCount: item.likeCount + (nextLiked ? 1 : -1) }
          : item
      )
    );
    setListLiked(supabase, list.id, session.user.id, nextLiked).catch(() => reload());
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
                {t('lists.newListButton')}
              </ThemedText>
            </Pressable>

            {lists.length === 0 ? (
              <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
                {t('lists.empty')}
              </ThemedText>
            ) : (
              lists.map((list) => (
                <ListCard
                  key={list.id}
                  list={list}
                  ownerUsername={username}
                  onPress={() =>
                    router.push({
                      pathname: '/lists/[id]',
                      params: { id: list.id, name: list.name, isPublic: list.isPublic ? '1' : '0' },
                    })
                  }
                  onToggleLike={() => handleToggleLike(list)}
                />
              ))
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      <Modal visible={createVisible} animationType="slide" transparent onRequestClose={() => setCreateVisible(false)}>
        <SheetRoot>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCreateVisible(false)} />
          <ThemedView type="backgroundElement" style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              {t('lists.newListTitle')}
            </ThemedText>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('lists.namePlaceholder')}
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t('lists.descriptionPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, styles.descriptionInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
              multiline
            />
            <View style={styles.visibilityRow}>
              <View style={styles.visibilityRowText}>
                <ThemedText type="default">{t('lists.publicList')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {isPublic ? 'Anyone with access can view this list.' : 'Only you can see this list.'}
                </ThemedText>
              </View>
              <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: Colors.light.primary }} />
            </View>
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
        </SheetRoot>
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
  visibilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  visibilityRowText: {
    flex: 1,
    gap: Spacing.half,
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
