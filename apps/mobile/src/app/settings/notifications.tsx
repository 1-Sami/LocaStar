import { fetchProfile, updateProfile, type NotificationPreferences } from '@locastar/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

const rows: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: 'reviews', label: 'Reviews', description: 'Replies and likes on your reviews' },
  { key: 'shares', label: 'Shares', description: 'When someone shares a place with you' },
  { key: 'marketing', label: 'News & offers', description: 'Product updates and promotions' },
];

const DEFAULT_PREFERENCES: NotificationPreferences = { reviews: true, shares: true, marketing: false };

export default function NotificationsScreen() {
  const { session } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let cancelled = false;
      setLoading(true);
      fetchProfile(supabase, session.user.id)
        .then((profile) => {
          if (!cancelled) setPreferences(profile.notification_preferences ?? DEFAULT_PREFERENCES);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [session])
  );

  const handleToggle = (key: keyof NotificationPreferences, value: boolean) => {
    if (!session) return;
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    updateProfile(supabase, session.user.id, { notification_preferences: next }).catch(() => {
      setPreferences(preferences);
    });
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
        <View style={styles.content}>
          {rows.map((row) => (
            <ThemedView key={row.key} type="backgroundElement" style={styles.row}>
              <View style={styles.rowText}>
                <ThemedText type="default">{row.label}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {row.description}
                </ThemedText>
              </View>
              <Switch
                value={preferences[row.key]}
                onValueChange={(value) => handleToggle(row.key, value)}
                trackColor={{ true: Colors.light.primary }}
              />
            </ThemedView>
          ))}
        </View>
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
  content: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
});
