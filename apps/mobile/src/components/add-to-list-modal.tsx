import {
  addLocationToList,
  createList,
  fetchListMembershipForLocation,
  fetchLists,
  removeLocationFromList,
  type LocationList,
} from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { SheetRoot } from '@/components/sheet-root';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
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
  const { t } = useTranslation();
  const theme = useTheme();
  const [lists, setLists] = useState<LocationList[]>([]);
  const [memberListIds, setMemberListIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyListId, setBusyListId] = useState<string | null>(null);

  /* Counted against the lists actually on screen, not the raw set: a
     membership row can outlive a list somebody deleted elsewhere. */
  const chosenCount = lists.filter((list) => memberListIds.has(list.id)).length;

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
      setLists((current) => [
        {
          id: listId,
          name: newListName.trim(),
          description: null,
          itemCount: 1,
          createdAt: new Date().toISOString(),
          isPublic: false,
          likeCount: 0,
          likedByMe: false,
          // The photo arrives on the next fetch; this is just the optimistic row.
          previewLocations: [{ locationId, imageUrl: null }],
        },
        ...current,
      ]);
      setMemberListIds((current) => new Set(current).add(listId));
      setNewListName('');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <SheetRoot>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <ThemedView type="backgroundElement" style={styles.modalContent}>
          <ThemedText type="subtitle" style={styles.modalTitle}>
            {t('components.addToList')}
          </ThemedText>

          {!loading && lists.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              {t('components.noListsYet')}
            </ThemedText>
          )}

          {lists.map((list) => {
            const chosen = memberListIds.has(list.id);
            return (
              <Pressable
                key={list.id}
                style={[
                  styles.listRow,
                  { borderColor: chosen ? theme.primary : theme.backgroundSelected },
                  chosen && { backgroundColor: theme.backgroundSelected },
                ]}
                disabled={busyListId === list.id}
                /* checkbox, not button: a place belongs to as many lists as you
                   like, and the row says so to a screen reader too. */
                accessibilityRole="checkbox"
                accessibilityState={{ checked: chosen }}
                onPress={() => handleToggle(list.id)}>
                <ThemedText type="default" style={styles.listName} numberOfLines={2}>
                  {list.name}
                </ThemedText>
                {busyListId === list.id ? (
                  <ActivityIndicator size="small" />
                ) : (
                  /* An empty circle rather than nothing: a blank space on the
                     right said "this row does not do anything", which is the
                     opposite of true. */
                  <Ionicons
                    name={chosen ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={chosen ? theme.primary : theme.textSecondary}
                  />
                )}
              </Pressable>
            );
          })}

          <View style={styles.newListRow}>
            <TextInput
              value={newListName}
              onChangeText={setNewListName}
              placeholder={t('components.newListName')}
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            />
            <Pressable
              style={[styles.createButton, (!newListName.trim() || creating) && styles.createButtonDisabled]}
              disabled={!newListName.trim() || creating}
              onPress={handleCreateAndAdd}>
              <ThemedText type="smallBold" style={styles.createButtonText}>
                {creating ? '…' : t('components.addAction')}
              </ThemedText>
            </Pressable>
          </View>

          {/*
            Done always closes the sheet — the add already happened on the tap
            — so a permanent grey slab was describing a disabled control that
            was not disabled. It fills once at least one list is ticked, which
            is the confirmation the sheet never gave.
          */}
          <Pressable
            style={[styles.doneButton, chosenCount > 0 && { backgroundColor: theme.primary }]}
            onPress={onClose}>
            <ThemedText type="smallBold" style={chosenCount > 0 ? styles.doneTextOn : undefined}>
              {t('form.done')}
            </ThemedText>
          </Pressable>
        </ThemedView>
      </SheetRoot>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.two,
  },
  listName: { flex: 1 },
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
  doneTextOn: { color: '#ffffff' },
});
