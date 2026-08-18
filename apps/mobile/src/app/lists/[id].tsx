import {
  DELETED_ACCOUNT_NAME,
  deleteList,
  fetchListItems,
  fetchListMeta,
  fetchListSavedState,
  fetchListShareRecipients,
  removeLocationFromList,
  renameList,
  setListSaved,
  setListVisibility,
  shareList,
  type ListItemLocation,
  type ListMeta,
  type ListShareRecipient,
} from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LocationPhoto } from '@/components/location-photo';
import { ShareModal } from '@/components/share-modal';
import { StarRating } from '@/components/star-rating';
import { SheetRoot } from '@/components/sheet-root';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { confirmAsync } from '@/lib/confirm';
import { useSharedProfile } from '@/lib/profile-context';

function formatListDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function sameDay(a: string, b: string): boolean {
  return formatListDate(a) === formatListDate(b);
}
export default function ListDetailScreen() {
  const { t } = useTranslation();
  const { id, name, shared, isPublic: isPublicParam } = useLocalSearchParams<{
    id: string;
    name?: string;
    shared?: string;
    isPublic?: string;
  }>();
  const router = useRouter();
  const theme = useTheme();
  const { session } = useAuth();
  const { isModerator } = useSharedProfile();
  const isSharedView = shared === '1';

  const [items, setItems] = useState<ListItemLocation[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyLocationId, setBusyLocationId] = useState<string | null>(null);
  const [shareVisible, setShareVisible] = useState(false);
  const [listName, setListName] = useState(name ?? 'List');
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(isPublicParam === '1');
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [shareRecipients, setShareRecipients] = useState<ListShareRecipient[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  // Only meaningful on someone else's list — you can't "save" your own.
  const reloadSavedState = useCallback(() => {
    if (!id || !isSharedView || !session) return;
    fetchListSavedState(supabase, id, session.user.id)
      .then(setIsSaved)
      .catch((err) => {
        // Only decides which way the Save control points; it corrects itself
        // on the next load.
        console.error('Failed to load the saved state', err);
      });
  }, [id, isSharedView, session]);

  const handleToggleSaved = () => {
    if (!session) {
      router.push('/sign-in');
      return;
    }
    const next = !isSaved;
    setIsSaved(next);
    setListSaved(supabase, id, session.user.id, next).catch(() => setIsSaved(!next));
  };

  const reload = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setLoadFailed(false);
    fetchListItems(supabase, id)
      .then(setItems)
      .catch((err) => {
        // Emptying renders "No places in this list yet", which is a claim about
        // someone's list rather than about the request that failed.
        console.error('Failed to load the list', err);
        setItems([]);
        setLoadFailed(true);
      })
      .finally(() => setLoading(false));
    fetchListMeta(supabase, id)
      .then(setMeta)
      .catch((err) => {
        console.error('Failed to load the list details', err);
        setMeta(null);
      });
  }, [id]);

  const reloadShareRecipients = useCallback(() => {
    if (!id || isSharedView) return;
    fetchListShareRecipients(supabase, id)
      .then(setShareRecipients)
      .catch((err) => {
        console.error('Failed to load who this list is shared with', err);
        setShareRecipients([]);
      });
  }, [id, isSharedView]);

  useFocusEffect(
    useCallback(() => {
      reload();
      reloadShareRecipients();
      reloadSavedState();
    }, [reload, reloadShareRecipients, reloadSavedState])
  );

  const handleRemove = async (locationId: string) => {
    const confirmed = await confirmAsync(t('listDetail.removeTitle'), t('listDetail.removeBody'));
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
      t('listDetail.deleteTitle'),
      t('listDetail.deleteBody')
    );
    if (!confirmed) return;
    await deleteList(supabase, id);
    router.back();
  };

  // Deleting somebody else's list is a moderation action, so it says so, and
  // it's recorded in the moderation log by a database trigger either way.
  const handleModeratorDeleteList = async () => {
    const confirmed = await confirmAsync(
      t('listDetail.moderatorDeleteTitle'),
      t('listDetail.moderatorDeleteBody'),
      t('common.delete')
    );
    if (!confirmed) return;
    await deleteList(supabase, id);
    router.back();
  };

  const handleShareList = async (recipientId: string) => {
    if (!session) return;
    await shareList(supabase, id, session.user.id, recipientId);
    reloadShareRecipients();
  };

  const handleToggleVisibility = async (value: boolean) => {
    setIsPublic(value);
    setVisibilitySaving(true);
    try {
      await setListVisibility(supabase, id, value);
    } catch {
      setIsPublic(!value);
    } finally {
      setVisibilitySaving(false);
    }
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
      setRenameError(t('listDetail.renameError'));
    } finally {
      setRenaming(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View style={styles.headerTitleRow}>
              <ThemedText type="default" style={styles.headerTitleText} numberOfLines={1}>
                {listName}
              </ThemedText>
              {!isSharedView && (
                <Pressable style={styles.headerPencilButton} onPress={handleOpenRename} hitSlop={8}>
                  <Ionicons name="pencil" size={14} color="#000000" />
                </Pressable>
              )}
            </View>
          ),
          headerRight: () =>
            isSharedView ? (
              <View style={styles.headerActions}>
                <Pressable style={styles.headerSaveButton} onPress={handleToggleSaved} hitSlop={8}>
                  <Ionicons
                    name={isSaved ? 'bookmark' : 'bookmark-outline'}
                    size={18}
                    color={isSaved ? '#F5C242' : theme.text}
                  />
                </Pressable>
                {isModerator && (
                  <Pressable
                    style={styles.headerDeleteButton}
                    onPress={handleModeratorDeleteList}
                    accessibilityLabel={t('listDetail.moderatorDeleteLabel')}
                    hitSlop={8}>
                    <Ionicons name="trash-outline" size={16} color="#ffffff" />
                  </Pressable>
                )}
              </View>
            ) : (
              <Pressable style={styles.headerDeleteButton} onPress={handleDeleteList} hitSlop={8}>
                <Ionicons name="trash-outline" size={16} color="#ffffff" />
              </Pressable>
            ),
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        {loading ? (
          <ActivityIndicator style={styles.loadingIndicator} />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {meta && (
              <View style={styles.attribution}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  by {meta.ownerUsername ?? meta.ownerDisplayName ?? DELETED_ACCOUNT_NAME}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('listDetail.created', { date: formatListDate(meta.createdAt) })}
                  {/* Only worth a second date once it differs — otherwise every
                      untouched list reads "Created X · Updated X". */}
                  {!sameDay(meta.createdAt, meta.updatedAt) &&
                    t('listDetail.updatedSuffix', { date: formatListDate(meta.updatedAt) })}
                </ThemedText>
              </View>
            )}
            {loadFailed ? (
              <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
                {t('common.somethingWentWrong')}
              </ThemedText>
            ) : items.length === 0 ? (
              <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
                {t('listDetail.empty')}
              </ThemedText>
            ) : (
              items.map((item) => (
                <ThemedView key={item.locationId} type="backgroundElement" style={styles.card}>
                  <View style={styles.cardRow}>
                    <View style={styles.cardContent}>
                      <Pressable
                        onPress={() => router.push({ pathname: '/location/[id]', params: { id: item.locationId } })}>
                        <ThemedText type="smallBold">{item.name}</ThemedText>
                      </Pressable>
                      <View style={styles.ratingRow}>
                        <StarRating rating={item.avgRating} size={14} />
                        <ThemedText type="small" themeColor="textSecondary">
                          {item.avgRating.toFixed(1)} · {item.reviewCount}{' '}
                          {t('reviewCount.label', { count: item.reviewCount })}
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
                            {t('listDetail.removeFromList')}
                          </ThemedText>
                        </Pressable>
                      )}
                    </View>
                    <LocationPhoto url={item.imageUrl} style={styles.cardImage} />
                  </View>
                </ThemedView>
              ))
            )}

            {!isSharedView && (
              <>
                <View style={styles.actionsRow}>
                  <Pressable style={styles.shareListButton} onPress={() => setShareVisible(true)}>
                    <ThemedText type="small" style={styles.shareListButtonText}>
                      {t('listDetail.shareTitle')}
                    </ThemedText>
                  </Pressable>

                  <View style={styles.visibilityInline}>
                    <ThemedText type="default">
                      {isPublic ? t('lists.publicList') : t('lists.privateList')}
                    </ThemedText>
                    <Switch
                      value={isPublic}
                      onValueChange={handleToggleVisibility}
                      disabled={visibilitySaving}
                      trackColor={{ true: Colors.light.primary }}
                    />
                  </View>
                </View>

                {shareRecipients.length > 0 && (
                  <View style={styles.sharedWithSection}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('listDetail.sharedWith')}
                    </ThemedText>
                    {shareRecipients.map((recipient) => (
                      <ThemedText key={recipient.shareId} type="small" themeColor="textSecondary">
                        @{recipient.recipientUsername ?? recipient.recipientDisplayName ?? 'someone'}
                      </ThemedText>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      <ShareModal
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        onShare={handleShareList}
        title={t('listDetail.shareTitle')}
        successNoun={t('listDetail.shareSuccessNoun')}
        showNote={false}
      />

      <Modal visible={renameVisible} animationType="slide" transparent onRequestClose={() => setRenameVisible(false)}>
        <SheetRoot>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setRenameVisible(false)} />
          <ThemedView type="backgroundElement" style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              {t('listDetail.renameTitle')}
            </ThemedText>
            <TextInput
              value={renameInput}
              onChangeText={setRenameInput}
              placeholder={t('listDetail.namePlaceholder')}
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
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
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
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  cardContent: {
    flex: 1,
    gap: Spacing.half,
  },
  cardImage: {
    width: 100,
    height: 76,
    borderRadius: Spacing.two,
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerTitleText: {
    maxWidth: 140,
  },
  headerPencilButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDeleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#C1272D',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.three,
  },
  headerSaveButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.three,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attribution: {
    gap: Spacing.half,
    marginBottom: Spacing.one,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.three,
  },
  shareListButton: {
    height: 29,
    paddingHorizontal: 19,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14747A',
  },
  shareListButtonText: {
    color: '#ffffff',
  },
  visibilityInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sharedWithSection: {
    marginTop: Spacing.two,
    gap: Spacing.half,
  },
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
