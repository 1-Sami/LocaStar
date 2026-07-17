import {
  createList,
  fetchLists,
  fetchListsSharedWithMe,
  fetchProfile,
  setListLiked,
  setListVisibility,
  type LocationList,
  type SharedList,
} from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { placeholderImage } from '@/lib/location-adapters';
import { supabase } from '@/lib/supabase';

function formatCreatedLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function ListCard({
  list,
  ownerUsername,
  onPress,
  onToggleLike,
  onToggleVisibility,
}: {
  list: LocationList;
  ownerUsername: string;
  onPress: () => void;
  onToggleLike: () => void;
  onToggleVisibility: () => void;
}) {
  const [main, ...rest] = list.previewLocationIds;

  return (
    <Pressable onPress={onPress}>
      <View style={styles.card}>
        <ThemedText type="smallBold" style={[styles.whiteText, styles.cardTitle]}>
          {list.name}
        </ThemedText>
        <ThemedText type="small" style={styles.whiteTextSecondary}>
          Created {formatCreatedLabel(list.createdAt)} by {ownerUsername}
        </ThemedText>

        <View style={styles.collage}>
          {main ? (
            <Image source={{ uri: placeholderImage(main) }} style={styles.mainPhoto} contentFit="cover" />
          ) : (
            <View style={[styles.mainPhoto, styles.photoPlaceholder]} />
          )}
          {rest.length > 0 && (
            <View style={styles.subPhotoColumn}>
              {rest.map((locationId) => (
                <Image
                  key={locationId}
                  source={{ uri: placeholderImage(locationId) }}
                  style={styles.subPhoto}
                  contentFit="cover"
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.footerRow}>
          <Pressable style={styles.likeButton} onPress={onToggleLike} hitSlop={8}>
            <Ionicons
              name={list.likedByMe ? 'thumbs-up' : 'thumbs-up-outline'}
              size={14}
              color={list.likedByMe ? '#4CD37A' : '#ffffff'}
            />
            <ThemedText type="smallBold" style={styles.whiteText}>
              {list.likeCount}
            </ThemedText>
          </Pressable>
          <Pressable style={styles.visibilityBadge} onPress={onToggleVisibility} hitSlop={8}>
            <Ionicons name={list.isPublic ? 'globe-outline' : 'lock-closed-outline'} size={11} color="#ffffff" />
            <ThemedText type="small" style={styles.whiteText}>
              {list.isPublic ? 'Public' : 'Private'}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

export default function MyListsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const theme = useTheme();

  const [lists, setLists] = useState<LocationList[]>([]);
  const [sharedLists, setSharedLists] = useState<SharedList[]>([]);
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
    Promise.all([
      fetchLists(supabase, session.user.id),
      fetchListsSharedWithMe(supabase, session.user.id).catch(() => []),
      fetchProfile(supabase, session.user.id).catch(() => null),
    ])
      .then(([listRows, sharedRows, profile]) => {
        setLists(listRows);
        setSharedLists(sharedRows);
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
      setError('Something went wrong creating the list. Try again.');
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

  const handleToggleVisibility = async (list: LocationList) => {
    const nextPublic = !list.isPublic;
    setLists((current) => current.map((item) => (item.id === list.id ? { ...item, isPublic: nextPublic } : item)));
    setListVisibility(supabase, list.id, nextPublic).catch(() => reload());
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
                <ListCard
                  key={list.id}
                  list={list}
                  ownerUsername={username}
                  onPress={() => router.push({ pathname: '/lists/[id]', params: { id: list.id, name: list.name } })}
                  onToggleLike={() => handleToggleLike(list)}
                  onToggleVisibility={() => handleToggleVisibility(list)}
                />
              ))
            )}

            {sharedLists.length > 0 && (
              <View style={styles.sharedSection}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sharedSectionTitle}>
                  Shared with you
                </ThemedText>
                {sharedLists.map((list) => (
                  <Pressable
                    key={list.id}
                    onPress={() =>
                      router.push({ pathname: '/lists/[id]', params: { id: list.id, name: list.name, shared: '1' } })
                    }>
                    <ThemedView type="backgroundElement" style={styles.sharedCard}>
                      <ThemedText type="smallBold">{list.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Shared by {list.senderUsername ?? list.senderDisplayName ?? 'someone'} ·{' '}
                        {list.itemCount} {list.itemCount === 1 ? 'place' : 'places'}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                ))}
              </View>
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
            <View style={styles.visibilityRow}>
              <View style={styles.visibilityRowText}>
                <ThemedText type="default">Public list</ThemedText>
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
  sharedSection: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  sharedSectionTitle: {
    textTransform: 'uppercase',
  },
  sharedCard: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  card: {
    borderRadius: Spacing.three * 0.8,
    padding: Spacing.three * 0.8,
    gap: Spacing.two * 0.8,
    backgroundColor: '#1B2A4A',
  },
  cardTitle: {
    fontSize: 14,
    lineHeight: 19,
  },
  collage: {
    flexDirection: 'row',
    gap: Spacing.two * 0.8,
    height: 120,
  },
  mainPhoto: {
    flex: 1,
    height: 120,
    borderRadius: Spacing.two,
  },
  photoPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  subPhotoColumn: {
    width: 56,
    gap: Spacing.two * 0.8,
  },
  subPhoto: {
    flex: 1,
    borderRadius: Spacing.two,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  visibilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  whiteText: {
    color: '#ffffff',
  },
  whiteTextSecondary: {
    color: 'rgba(255,255,255,0.75)',
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
