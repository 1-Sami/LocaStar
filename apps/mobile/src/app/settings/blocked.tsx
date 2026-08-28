import { fetchBlockedUsers, unblockUser, type BlockedUser } from '@locastar/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useBlockedUsers } from '@/lib/blocked-users-context';
import { confirmAsync } from '@/lib/confirm';
import { supabase } from '@/lib/supabase';

export default function BlockedUsersScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { refresh: refreshBlocked } = useBlockedUsers();
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!session) return;
    setLoading(true);
    fetchBlockedUsers(supabase, session.user.id)
      .then(setBlocked)
      .catch((err) => {
        // The worst of the three to get wrong: "nobody blocked" when the
        // load failed suggests somebody's blocks have been undone.
        console.error('Failed to load blocked users', err);
        setLoadFailed(true);
      })
      .finally(() => setLoading(false));
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const handleUnblock = async (entry: BlockedUser) => {
    const name = entry.username ?? entry.displayName ?? t('settings.somePerson');
    const confirmed = await confirmAsync(
      t('settings.unblockTitle', { name }),
      t('settings.unblockBody', { name }),
      t('settings.unblock')
    );
    if (!confirmed) return;

    setBusyId(entry.blockId);
    try {
      await unblockUser(supabase, entry.blockId);
      setBlocked((current) => current.filter((b) => b.blockId !== entry.blockId));
      // The shared set is what every other screen filters on, so without this
      // their content would stay hidden until the app was restarted.
      refreshBlocked();
    } finally {
      setBusyId(null);
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
          {loadFailed ? (
            <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
              {t('common.somethingWentWrong')}
            </ThemedText>
          ) : blocked.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
              {t('settings.noBlocked')}
            </ThemedText>
          ) : (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                {t('settings.blockedHint')}
              </ThemedText>
              {blocked.map((entry) => (
                <ThemedView key={entry.blockId} type="backgroundElement" style={styles.row}>
                  <Avatar url={entry.avatarUrl} size={40} />
                  <View style={styles.rowText}>
                    <ThemedText type="smallBold">
                      {entry.username ?? entry.displayName ?? t('settings.unnamedUser')}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Blocked {new Date(entry.createdAt).toLocaleDateString()}
                    </ThemedText>
                  </View>
                  <Pressable
                    disabled={busyId === entry.blockId}
                    onPress={() => handleUnblock(entry)}
                    hitSlop={8}>
                    <ThemedText type="smallBold" style={styles.unblockText}>
                      {t('settings.unblock')}
                    </ThemedText>
                  </Pressable>
                </ThemedView>
              ))}
            </>
          )}
        </ScrollView>
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
    padding: Spacing.three,
    gap: Spacing.two,
  },
  emptyText: {
    marginTop: Spacing.four,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
  unblockText: {
    color: '#14747A',
  },
});
