import {
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { confirmAsync } from '@/lib/confirm';
import { useNotificationsBadge } from '@/lib/notifications-context';
import { supabase } from '@/lib/supabase';

export default function NotificationsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { refreshUnreadCount } = useNotificationsBadge();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (!session) return;
    setLoading(true);
    fetchNotifications(supabase, session.user.id)
      .then(setNotifications)
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      reload();
      refreshUnreadCount();
    }, [reload, refreshUnreadCount])
  );

  const handleOpen = async (notification: Notification) => {
    if (!notification.readAt) {
      markNotificationRead(supabase, notification.id).catch(() => {});
      setNotifications((current) =>
        current.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      refreshUnreadCount();
    }
    if (notification.type === 'list_share') {
      router.push({ pathname: '/lists/[id]', params: { id: notification.payload.list_id, shared: '1' } });
    } else {
      router.push({ pathname: '/location/[id]', params: { id: notification.payload.location_id } });
    }
  };

  const handleMarkAllRead = async () => {
    if (!session) return;
    setNotifications((current) => current.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    await markAllNotificationsRead(supabase, session.user.id).catch(() => {});
    refreshUnreadCount();
  };

  const handleDelete = async (notification: Notification) => {
    const confirmed = await confirmAsync(
      'Delete this notification?',
      "This can't be undone.",
      'Delete'
    );
    if (!confirmed) return;
    setNotifications((current) => current.filter((n) => n.id !== notification.id));
    deleteNotification(supabase, notification.id).catch(() => reload());
    if (!notification.readAt) refreshUnreadCount();
  };

  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="subtitle" style={styles.header}>
          Notifications
        </ThemedText>

        {loading ? (
          <ActivityIndicator style={styles.loadingIndicator} />
        ) : notifications.length === 0 ? (
          <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
            No notifications yet.
          </ThemedText>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {hasUnread && (
              <Pressable onPress={handleMarkAllRead} style={styles.markAllRow}>
                <ThemedText type="linkPrimary">Mark all as read</ThemedText>
              </Pressable>
            )}
            {notifications.map((notification) => (
              <View key={notification.id} style={styles.cardWrapper}>
                <Pressable onPress={() => handleOpen(notification)}>
                  <ThemedView
                    type="backgroundElement"
                    style={[styles.card, !notification.readAt && styles.cardUnread]}>
                    <ThemedText type="default" style={styles.noteText}>
                      {notification.type === 'list_share'
                        ? `Shared the list "${notification.payload.list_name ?? 'Untitled'}" with you`
                        : notification.payload.note
                          ? `"${notification.payload.note}"`
                          : `Shared ${notification.payload.location_name ?? 'a location'} with you`}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Shared by {notification.payload.sender_name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.dateText}>
                      {new Date(notification.createdAt).toLocaleString()}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
                <Pressable
                  style={styles.deleteButton}
                  onPress={() => handleDelete(notification)}
                  hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color="#E05252" />
                </Pressable>
              </View>
            ))}
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
    paddingHorizontal: Spacing.three,
  },
  header: {
    fontSize: 24,
    lineHeight: 31,
    paddingVertical: Spacing.two,
  },
  loadingIndicator: {
    marginTop: Spacing.six,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: Spacing.six,
  },
  content: {
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  markAllRow: {
    alignItems: 'flex-end',
    marginBottom: Spacing.one,
  },
  cardWrapper: {
    position: 'relative',
  },
  card: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    paddingRight: Spacing.five,
    gap: Spacing.half,
  },
  cardUnread: {
    borderWidth: 1,
    borderColor: '#14747A',
  },
  deleteButton: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
  },
  noteText: {
    fontWeight: '700',
  },
  dateText: {
    fontSize: 10,
    lineHeight: 14,
  },
});
