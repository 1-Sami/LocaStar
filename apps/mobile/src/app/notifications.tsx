import { fetchNotifications, markAllNotificationsRead, markNotificationRead, type Notification } from '@locastar/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

export default function NotificationsScreen() {
  const { session } = useAuth();
  const router = useRouter();
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
    }, [reload])
  );

  const handleOpen = async (notification: Notification) => {
    if (!notification.readAt) {
      markNotificationRead(supabase, notification.id).catch(() => {});
      setNotifications((current) =>
        current.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n))
      );
    }
    router.push({ pathname: '/location/[id]', params: { id: notification.payload.location_id } });
  };

  const handleMarkAllRead = async () => {
    if (!session) return;
    setNotifications((current) => current.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    await markAllNotificationsRead(supabase, session.user.id).catch(() => {});
  };

  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
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
              <Pressable key={notification.id} onPress={() => handleOpen(notification)}>
                <ThemedView
                  type="backgroundElement"
                  style={[styles.card, !notification.readAt && styles.cardUnread]}>
                  <ThemedText type="default">
                    <ThemedText type="smallBold">{notification.payload.sender_name}</ThemedText> shared{' '}
                    <ThemedText type="smallBold">{notification.payload.location_name ?? 'a location'}</ThemedText>{' '}
                    with you
                  </ThemedText>
                  {notification.payload.note && (
                    <ThemedText type="small" themeColor="textSecondary">
                      "{notification.payload.note}"
                    </ThemedText>
                  )}
                  <ThemedText type="small" themeColor="textSecondary">
                    {new Date(notification.createdAt).toLocaleString()}
                  </ThemedText>
                </ThemedView>
              </Pressable>
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
  },
  loadingIndicator: {
    marginTop: Spacing.six,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  markAllRow: {
    alignItems: 'flex-end',
    marginBottom: Spacing.one,
  },
  card: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  cardUnread: {
    borderWidth: 1,
    borderColor: '#14747A',
  },
});
