import { fetchPublicLists, setListLiked, type PublicList } from '@locastar/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListCard } from '@/components/list-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

export default function CommunityScreen() {
  const { session } = useAuth();
  const router = useRouter();

  const [lists, setLists] = useState<PublicList[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    fetchPublicLists(supabase, session?.user.id ?? null)
      .then((rows) => {
        if (!cancelled) setLists(rows);
      })
      .catch(() => {
        if (!cancelled) setLists([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

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
        {loading ? (
          <ActivityIndicator style={styles.loadingIndicator} />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {lists.length === 0 ? (
              <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
                No public lists yet.
              </ThemedText>
            ) : (
              lists.map((list) => (
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
