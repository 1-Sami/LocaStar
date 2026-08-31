import {
  fetchPublicLists,
  setListLiked,
  type PublicList,
  type PublicListSort,
} from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListCard } from '@/components/list-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useBlockedUsers } from '@/lib/blocked-users-context';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const SORT_OPTIONS: { key: PublicListSort; labelKey: string }[] = [
  { key: 'newest', labelKey: 'community.sortNewest' },
  { key: 'most_liked', labelKey: 'community.sortMostLiked' },
  { key: 'least_liked', labelKey: 'community.sortLeastLiked' },
];

export default function CommunityScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const router = useRouter();
  const theme = useTheme();

  const [lists, setLists] = useState<PublicList[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [sort, setSort] = useState<PublicListSort>('newest');
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const { isBlocked } = useBlockedUsers();
  const insets = useSafeAreaInsets();

  // Filtered at render rather than at fetch, so blocking someone from a list
  // empties them out of this feed on the tap instead of on the next reload.
  const visibleLists = lists.filter((list) => !isBlocked(list.ownerId));

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    fetchPublicLists(supabase, session?.user.id ?? null, sort)
      .then((rows) => {
        if (!cancelled) setLists(rows);
      })
      .catch((err) => {
        // Emptying the list here would render as "no public lists yet",
        // which is a different and untrue statement.
        console.error('Failed to load public lists', err);
        if (!cancelled) setLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user.id, sort]);

  useFocusEffect(
    useCallback(() => {
      return reload();
    }, [reload])
  );

  const handleToggleLike = (list: PublicList) => {
    if (!session) {
      router.push('/sign-in');
      return;
    }
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
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.sortRow}>
          <Pressable
            style={[styles.sortButton, { backgroundColor: theme.backgroundSelected }]}
            onPress={() => setSortMenuVisible(true)}>
            <Ionicons name="swap-vertical" size={14} color={theme.text} />
            <ThemedText type="small">
              {t(SORT_OPTIONS.find((option) => option.key === sort)?.labelKey ?? 'common.sort')}
            </ThemedText>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator style={styles.loadingIndicator} />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {loadFailed ? (
              <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
                {t('common.somethingWentWrong')}
              </ThemedText>
            ) : visibleLists.length === 0 ? (
              <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
                {t('community.empty')}
              </ThemedText>
            ) : (
              visibleLists.map((list) => (
                <View key={list.id} style={styles.cardSlot}>
                  <ListCard
                    list={list}
                    ownerUsername={list.ownerUsername ?? list.ownerDisplayName ?? 'someone'}
                    onPress={() =>
                      router.push({
                        pathname: '/lists/[id]',
                        params: { id: list.id, name: list.name, isPublic: '1', shared: '1' },
                      })
                    }
                    onToggleLike={() => handleToggleLike(list)}
                  />
                </View>
              ))
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      <Modal
        visible={sortMenuVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSortMenuVisible(false)}>
        <Pressable
          style={[styles.modalBackdrop, { paddingBottom: insets.bottom }]}
          onPress={() => setSortMenuVisible(false)}>
          <ThemedView type="backgroundElement" style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              {t('community.sortBy')}
            </ThemedText>
            {SORT_OPTIONS.map((option) => (
              <Pressable
                key={option.key}
                style={styles.modalRow}
                onPress={() => {
                  setSort(option.key);
                  setSortMenuVisible(false);
                }}>
                <ThemedText type="default">{t(option.labelKey)}</ThemedText>
                {sort === option.key && <Ionicons name="checkmark" size={18} color={theme.primary} />}
              </Pressable>
            ))}
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
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  loadingIndicator: {
    marginTop: Spacing.six,
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.five,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
  },
  modalTitle: {
    fontSize: 20,
    lineHeight: 26,
    marginBottom: Spacing.two,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  content: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  cardSlot: {
    width: '48%',
    marginBottom: Spacing.two,
  },
  emptyText: {
    width: '100%',
    textAlign: 'center',
    marginTop: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
});
