import {
  deleteList,
  fetchListItems,
  removeLocationFromList,
  renameList,
  shareList,
  type ListItemLocation,
} from '@locastar/shared';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShareModal } from '@/components/share-modal';
import { StarRating } from '@/components/star-rating';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { confirmAsync } from '@/lib/confirm';
import { supabase } from '@/lib/supabase';

export default function ListDetailScreen() {
  const { id, name, shared } = useLocalSearchParams<{ id: string; name?: string; shared?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { session } = useAuth();
  const isSharedView = shared === '1';

  const [items, setItems] = useState<ListItemLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyLocationId, setBusyLocationId] = useState<string | null>(null);
  const [shareVisible, setShareVisible] = useState(false);
  const [listName, setListName] = useState(name ?? 'List');
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!id) return;
    setLoading(true);
    fetchListItems(supabase, id)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const handleRemove = async (locationId: string) => {
    const confirmed = await confirmAsync('Remove from list?', 'This place will be removed from this list.');
    if (!confirmed) return;
    setBusyLocationId(locationId);
    try {
      await removeLocationFromList(supabase, id, locationId);
      setItems((current) => current.filter((item) => item.locationId !== locationId));
    } finally {
      setBusyLocationId(null);
    }
  };

  const handleDeleteList = async () => {
    const confirmed = await confirmAsync(
      'Delete this list?',
      'This permanently deletes the list and removes all its places. This can\'t be undone.'
    );
    if (!confirmed) return;
    await deleteList(supabase, id);
    router.back();
  };

  const handleShareList = async (recipientId: string) => {
    if (!session) return;
    await shareList(supabase, id, session.user.id, recipientId);
  };

  const handleOpenRename = () => {
    setRenameInput(listName);
    setRenameError(null);
    setRenameVisible(true);
  };

  const handleRename = async () => {
    const trimmed = renameInput.trim();
    if (!trimmed) return;
    setRenaming(true);
    setRenameError(null);
    try {
      await renameList(supabase, id, trimmed);
      setListName(trimmed);
      setRenameVisible(false);
    } catch {
      setRenameError('Something went wrong renaming the list. Try again.');
    } finally {
      setRenaming(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: listName }} />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        {loading ? (
          <ActivityIndicator style={styles.loadingIndicator} />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {items.length === 0 ? (
              <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
                No places in this list yet. Add one from a location's page.
              </ThemedText>
            ) : (
              items.map((item) => (
                <ThemedView key={item.locationId} type="backgroundElement" style={styles.card}>
                  <Pressable onPress={() => router.push({ pathname: '/location/[id]', params: { id: item.locationId } })}>
                    <ThemedText type="smallBold">{item.name}</ThemedText>
                  </Pressable>
                  <View style={styles.ratingRow}>
                    <StarRating rating={item.avgRating} size={14} />
                    <ThemedText type="small" themeColor="textSecondary">
                      {item.avgRating.toFixed(1)} · {item.reviewCount} reviews
                    </ThemedText>
                  </View>
                  {item.note && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {item.note}
                    </ThemedText>
                  )}
                  {!isSharedView && (
                    <Pressable
                      onPress={() => handleRemove(item.locationId)}
                      disabled={busyLocationId === item.locationId}
                      style={styles.removeButton}>
                      <ThemedText type="small" style={styles.removeButtonText}>
                        Remove from list
                      </ThemedText>
                    </Pressable>
                  )}
                </ThemedView>
              ))
            )}

            {!isSharedView && (
              <>
                <Pressable style={styles.renameListButton} onPress={handleOpenRename}>
                  <ThemedText type="smallBold">Rename this list</ThemedText>
                </Pressable>

                <Pressable style={styles.shareListButton} onPress={() => setShareVisible(true)}>
                  <ThemedText type="smallBold" style={styles.shareListButtonText}>
                    Share this list
                  </ThemedText>
                </Pressable>

                <Pressable style={styles.deleteListButton} onPress={handleDeleteList}>
                  <ThemedText type="smallBold" style={styles.deleteListButtonText}>
                    Delete this list
                  </ThemedText>
                </Pressable>
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      <ShareModal
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        onShare={handleShareList}
        title="Share this list"
        successNoun="in their Lists"
        showNote={false}
      />

      <Modal visible={renameVisible} animationType="slide" transparent onRequestClose={() => setRenameVisible(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setRenameVisible(false)} />
          <ThemedView type="backgroundElement" style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              Rename list
            </ThemedText>
            <TextInput
              value={renameInput}
              onChangeText={setRenameInput}
              placeholder="List name"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
              autoFocus
            />
            {renameError && (
              <ThemedText type="small" style={styles.errorText}>
                {renameError}
              </ThemedText>
            )}
            <Pressable
              style={[styles.saveRenameButton, (!renameInput.trim() || renaming) && styles.saveRenameButtonDisabled]}
              disabled={!renameInput.trim() || renaming}
              onPress={handleRename}>
              <ThemedText type="smallBold" style={styles.shareListButtonText}>
                {renaming ? 'Saving…' : 'Save'}
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
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  removeButton: {
    marginTop: Spacing.one,
    alignSelf: 'flex-start',
  },
  removeButtonText: {
    color: '#E05252',
  },
  renameListButton: {
    height: 48,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(128,128,128,0.15)',
    marginTop: Spacing.three,
  },
  shareListButton: {
    height: 48,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14747A',
    marginTop: Spacing.two,
  },
  shareListButtonText: {
    color: '#ffffff',
  },
  deleteListButton: {
    height: 48,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(224,82,82,0.15)',
    marginTop: Spacing.two,
  },
  deleteListButtonText: {
    color: '#E05252',
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
  errorText: {
    color: '#E05252',
  },
  saveRenameButton: {
    height: 48,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14747A',
    marginTop: Spacing.two,
  },
  saveRenameButtonDisabled: {
    opacity: 0.5,
  },
});
