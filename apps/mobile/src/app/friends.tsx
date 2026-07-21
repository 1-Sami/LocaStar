import {
  acceptFriendRequest,
  fetchFriendships,
  removeFriendship,
  sendFriendRequest,
  type Friend,
} from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShareModal } from '@/components/share-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { confirmAsync } from '@/lib/confirm';
import { placeholderImage } from '@/lib/location-adapters';
import { supabase } from '@/lib/supabase';

function FriendRow({
  friend,
  children,
}: {
  friend: Friend;
  children?: React.ReactNode;
}) {
  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      <Image
        source={{ uri: friend.avatarUrl ?? placeholderImage(`avatar-${friend.userId}`) }}
        style={styles.avatar}
      />
      <View style={styles.rowText}>
        <ThemedText type="smallBold">{friend.displayName ?? friend.username ?? 'Unnamed user'}</ThemedText>
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
  const { session } = useAuth();
  const [friendships, setFriendships] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [addVisible, setAddVisible] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!session) return;
    setLoading(true);
    fetchFriendships(supabase, session.user.id)
      .then(setFriendships)
      .catch(() => setFriendships([]))
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

  const handleRemove = async (friend: Friend) => {
    const confirmed = await confirmAsync(
      'Remove this friend?',
      `${friend.displayName ?? friend.username ?? 'This person'} will be removed from your friends list.`,
      'Remove'
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
                + Add friend
              </ThemedText>
            </Pressable>

            {incomingRequests.length > 0 && (
              <View style={styles.section}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
                  Requests
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
                    </View>
                  </FriendRow>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
                Friends ({friends.length})
              </ThemedText>
              {friends.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  No friends yet. Search for someone to add them.
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
                  Sent requests
                </ThemedText>
                {outgoingRequests.map((friend) => (
                  <FriendRow key={friend.friendshipId} friend={friend}>
                    <Pressable
                      disabled={busyId === friend.friendshipId}
                      onPress={() => handleCancelRequest(friend)}
                      hitSlop={8}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Cancel
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
        title="Add a friend"
        successMessage={(name) => `A friend request was sent to ${name}.`}
        errorMessage="Something went wrong sending the friend request. Try again."
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
});
