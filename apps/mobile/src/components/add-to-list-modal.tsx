import {
  addLocationToList,
  createList,
  fetchListMembershipForLocation,
  fetchLists,
  removeLocationFromList,
  type LocationList,
} from '@locastar/shared';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export function AddToListModal({
  visible,
  userId,
  locationId,
  onClose,
}: {
  visible: boolean;
  userId: string;
  locationId: string;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [lists, setLists] = useState<LocationList[]>([]);
  const [memberListIds, setMemberListIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyListId, setBusyListId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    Promise.all([fetchLists(supabase, userId), fetchListMembershipForLocation(supabase, userId, locationId)])
      .then(([listsResult, membership]) => {
        setLists(listsResult);
        setMemberListIds(membership);
      })
      .catch(() => {
        setLists([]);
        setMemberListIds(new Set());
      })
      .finally(() => setLoading(false));
  }, [visible, userId, locationId]);

  const handleToggle = async (listId: string) => {
    const isMember = memberListIds.has(listId);
    setBusyListId(listId);
    const next = new Set(memberListIds);
    if (isMember) {
      next.delete(listId);
    } else {
      next.add(listId);
    }
    setMemberListIds(next);
    try {
      if (isMember) {
        await removeLocationFromList(supabase, listId, locationId);
      } else {
        await addLocationToList(supabase, listId, locationId);
      }
    } catch {
      setMemberListIds(memberListIds);
    } finally {
      setBusyListId(null);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newListName.trim()) return;
    setCreating(true);
    try {
      const listId = await createList(supabase, userId, newListName.trim(), null);
      await addLocationToList(supabase, listId, locationId);
      setLists((current) => [{ id: listId, name: newListName.trim(), description: null, itemCount: 1, createdAt: new Date().toISOString() }, ...current]);
      setMemberListIds((current) => new Set(current).add(listId));
      setNewListName('');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <ThemedView type="backgroundElement" style={styles.modalContent}>
          <ThemedText type="subtitle" style={styles.modalTitle}>
            Add to list
          </ThemedText>

          {!loading && lists.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              You don't have any lists yet — create one below.
            </ThemedText>
          )}

          {lists.map((list) => (
            <Pressable
              key={list.id}
              style={styles.listRow}
              disabled={busyListId === list.id}
              onPress={() => handleToggle(list.id)}>
              <ThemedText type="default">{list.name}</ThemedText>
              <ThemedText type="default">{memberListIds.has(list.id) ? '✓' : ''}</ThemedText>
            </Pressable>
          ))}

          <View style={styles.newListRow}>
            <TextInput
              value={newListName}
              onChangeText={setNewListName}
              placeholder="New list name"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            />
            <Pressable
              style={[styles.createButton, (!newListName.trim() || creating) && styles.createButtonDisabled]}
              disabled={!newListName.trim() || creating}
              onPress={handleCreateAndAdd}>
              <ThemedText type="smallBold" style={styles.createButtonText}>
                {creating ? '…' : 'Add'}
              </ThemedText>
            </Pressable>
          </View>

          <Pressable style={styles.doneButton} onPress={onClose}>
            <ThemedText type="smallBold">Done</ThemedText>
          </Pressable>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  newListRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  createButton: {
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14747A',
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#ffffff',
  },
  doneButton: {
    height: 44,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(128,128,128,0.25)',
    marginTop: Spacing.two,
  },
});
