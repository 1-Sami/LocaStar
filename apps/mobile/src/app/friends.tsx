import {
  acceptFriendRequest,
  blockUser,
  fetchFriendships,
  removeFriendship,
  sendFriendRequest,
  type Friend,
} from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ShareModal } from '@/components/share-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { confirmAsync } from '@/lib/confirm';
import { supabase } from '@/lib/supabase';

function FriendRow({
  friend,
  children,
}: {
  friend: Friend;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      <Avatar url={friend.avatarUrl} size={40} />
      <View style={styles.rowText}>
        <ThemedText type="smallBold">{friend.username ?? friend.displayName ?? t('settings.unnamedUser')}</ThemedText>
        {friend.username && (
          <ThemedText type="small" themeColor="textSecondary">
            @{friend.username}
          </ThemedText>
        )}
      </View>
      {children}
    </ThemedView>
  );
}

export default function FriendsScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [friendships, setFriendships] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!session) return;
    setLoading(true);
    fetchFriendships(supabase, session.user.id)
      .then(setFriendships)
      .catch((err) => {
        // Somebody with friends seeing "no friends yet" reads as data loss.
        console.error('Failed to load friends', err);
        setLoadFailed(true);
      })
      .finally(() => setLoading(false));
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const handleSendRequest = async (targetUserId: string) => {
    if (!session) return;
    await sendFriendRequest(supabase, session.user.id, targetUserId);
    reload();
  };

  const handleAccept = async (friend: Friend) => {
    setBusyId(friend.friendshipId);
    try {
      await acceptFriendRequest(supabase, friend.friendshipId);
      reload();
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (friend: Friend) => {
    setBusyId(friend.friendshipId);
    try {
      await removeFriendship(supabase, friend.friendshipId);
      setFriendships((current) => current.filter((f) => f.friendshipId !== friend.friendshipId));
    } finally {
      setBusyId(null);
    }
  };

  // Blocking is the only irreversible-feeling action here and it sits next to
  // Decline, so it gets a confirmation naming the person and spelling out what
  // it does — including that it can be undone, so nobody avoids it out of
  // uncertainty.
  const handleBlock = async (friend: Friend) => {
    if (!session) return;
    const name = friend.username ?? friend.displayName ?? t('common.somePerson');
    const confirmed = await confirmAsync(
      t('friends.blockTitle', { name }),
      t('friends.blockBody', { name }),
      t('friends.block')
    );
    if (!confirmed) return;

    setBusyId(friend.friendshipId);
    try {
      await blockUser(supabase, session.user.id, friend.userId);
      // The block also clears the friendship row, so drop it locally too.
      setFriendships((current) => current.filter((f) => f.friendshipId !== friend.friendshipId));
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (friend: Friend) => {
    const confirmed = await confirmAsync(
      t('friends.removeTitle'),
      t('friends.removeBody', {
        name: friend.username ?? friend.displayName ?? t('common.somePerson'),
      }),
      t('common.remove')
    );
    if (!confirmed) return;
    setBusyId(friend.friendshipId);
    try {
      await removeFriendship(supabase, friend.friendshipId);
      setFriendships((current) => current.filter((f) => f.friendshipId !== friend.friendshipId));
    } finally {
      setBusyId(null);
    }
  };

  const handleCancelRequest = async (friend: Friend) => {
    setBusyId(friend.friendshipId);
    try {
      await removeFriendship(supabase, friend.friendshipId);
      setFriendships((current) => current.filter((f) => f.friendshipId !== friend.friendshipId));
    } finally {
      setBusyId(null);
    }
  };

  const incomingRequests = friendships.filter((f) => f.status === 'pending' && f.direction === 'incoming');
  const outgoingRequests = friendships.filter((f) => f.status === 'pending' && f.direction === 'outgoing');
  const friends = friendships.filter((f) => f.status === 'accepted');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        {loading ? (
          <ActivityIndicator style={styles.loadingIndicator} />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <Pressable style={styles.addButton} onPress={() => setAddVisible(true)}>
              <ThemedText type="smallBold" style={styles.addButtonText}>
                {t('friends.addFriend')}
              </ThemedText>
            </Pressable>

            {incomingRequests.length > 0 && (
              <View style={styles.section}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
                  {t('friends.requests')}
                </ThemedText>
                {incomingRequests.map((friend) => (
                  <FriendRow key={friend.friendshipId} friend={friend}>
                    <View style={styles.requestActions}>
                      <Pressable
                        style={[styles.iconButton, styles.acceptButton]}
                        disabled={busyId === friend.friendshipId}
                        onPress={() => handleAccept(friend)}
                        hitSlop={8}>
                        <Ionicons name="checkmark" size={18} color="#ffffff" />
                      </Pressable>
                      <Pressable
                        style={[styles.iconButton, styles.declineButton]}
                        disabled={busyId === friend.friendshipId}
                        onPress={() => handleDecline(friend)}
                        hitSlop={8}>
                        <Ionicons name="close" size={18} color="#ffffff" />
                      </Pressable>
                      <Pressable
                        style={[styles.iconButton, styles.blockButton]}
                        disabled={busyId === friend.friendshipId}
                        onPress={() => handleBlock(friend)}
                        accessibilityLabel={t('friends.blockNamed', {
                          name: friend.username ?? friend.displayName ?? t('common.somePerson'),
                        })}
                        hitSlop={8}>
                        <Ionicons name="ban" size={18} color="#ffffff" />
                      </Pressable>
                    </View>
                  </FriendRow>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
                {t('friends.friendsCount', { count: friends.length })}
              </ThemedText>
              {loadFailed ? (
                <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
                  {t('common.somethingWentWrong')}
                </ThemedText>
              ) : friends.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  {t('friends.empty')}
                </ThemedText>
              ) : (
                friends.map((friend) => (
                  <FriendRow key={friend.friendshipId} friend={friend}>
                    <Pressable onPress={() => handleRemove(friend)} hitSlop={8}>
                      <Ionicons name="close-circle" size={20} color="#E05252" />
                    </Pressable>
                  </FriendRow>
                ))
              )}
            </View>

            {outgoingRequests.length > 0 && (
              <View style={styles.section}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
                  {t('friends.sentRequests')}
                </ThemedText>
                {outgoingRequests.map((friend) => (
                  <FriendRow key={friend.friendshipId} friend={friend}>
                    <Pressable
                      disabled={busyId === friend.friendshipId}
                      onPress={() => handleCancelRequest(friend)}
                      hitSlop={8}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('common.cancel')}
                      </ThemedText>
                    </Pressable>
                  </FriendRow>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      <ShareModal
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        onShare={handleSendRequest}
        title={t('friends.addAFriend')}
        successMessage={(name) => t('friends.requestSent', { name })}
        errorMessage={t('friends.requestFailed')}
        showNote={false}
      />
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
    gap: Spacing.four,
  },
  addButton: {
    height: 44,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14747A',
  },
  addButtonText: {
    color: '#ffffff',
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    textTransform: 'uppercase',
  },
  emptyText: {
    paddingVertical: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
  rowText: {
    flex: 1,
  },
  requestActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: '#14747A',
  },
  declineButton: {
    backgroundColor: '#E05252',
  },
  // Deliberately darker than Decline rather than a third bright colour —
  // Block sits next to it and should not read as just another way to say no.
  blockButton: {
    backgroundColor: '#4A4A4A',
  },
});
