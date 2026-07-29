import {
  fetchModerationActions,
  fetchProfile,
  isModeratorRole,
  type ModerationAction,
  type UserRole,
} from '@locastar/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

const ACTION_LABELS: Record<string, string> = {
  location_status_changed: 'Location status changed',
  review_status_changed: 'Review status changed',
  ban_issued: 'Ban issued',
  ban_reviewed: 'Ban reviewed',
  role_changed: 'Role changed',
  report_resolved: 'Report resolved',
  warning_issued: 'Warning issued',
};

const ACTION_COLORS: Record<string, string> = {
  ban_issued: '#E05252',
  ban_reviewed: '#E8A93B',
  role_changed: '#4C8FE8',
  warning_issued: '#E8A93B',
};

function roleLabel(role: UserRole | null): string {
  if (role === 'admin') return 'Admin';
  if (role === 'superuser') return 'Superuser';
  return 'User';
}

/** Renders the jsonb detail as "from → to" where present, else key: value lines. */
function detailLines(detail: Record<string, unknown> | null): string[] {
  if (!detail) return [];
  const lines: string[] = [];
  if (detail.from !== undefined || detail.to !== undefined) {
    lines.push(`${String(detail.from ?? '—')} → ${String(detail.to ?? '—')}`);
  }
  for (const [key, value] of Object.entries(detail)) {
    if (key === 'from' || key === 'to' || value === null || value === undefined) continue;
    if (key.endsWith('_id')) continue;
    lines.push(`${key.replace(/_/g, ' ')}: ${String(value)}`);
  }
  return lines;
}

export default function AdminAuditScreen() {
  const { session } = useAuth();
  const [actions, setActions] = useState<ModerationAction[]>([]);
  const [myRole, setMyRole] = useState<UserRole>('user');
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (!session) return;
    setLoading(true);
    Promise.all([fetchProfile(supabase, session.user.id), fetchModerationActions(supabase, 200)])
      .then(([profile, rows]) => {
        setMyRole(profile.role);
        setActions(rows);
      })
      .catch(() => setActions([]))
      .finally(() => setLoading(false));
  }, [session]);

  useFocusEffect(useCallback(() => reload(), [reload]));

  if (!session || (!loading && !isModeratorRole(myRole))) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
            You don&apos;t have access to this page.
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        {loading ? (
          <ActivityIndicator style={styles.loadingIndicator} />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <ThemedText type="small" themeColor="textSecondary">
              {myRole === 'admin'
                ? 'Every moderation action taken in the app, newest first.'
                : 'Your own moderation actions, newest first. Admins can see everyone’s.'}
            </ThemedText>

            {actions.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                Nothing logged yet.
              </ThemedText>
            ) : (
              actions.map((entry) => (
                <ThemedView key={entry.id} type="backgroundElement" style={styles.card}>
                  <View style={styles.cardHeader}>
                    <ThemedText type="smallBold" style={{ color: ACTION_COLORS[entry.action] ?? undefined }}>
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {new Date(entry.createdAt).toLocaleString()}
                    </ThemedText>
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {entry.actorName} · {roleLabel(entry.actorRole)} · {entry.targetType}
                  </ThemedText>
                  {detailLines(entry.detail).map((line, index) => (
                    <ThemedText key={index} type="small">
                      {line}
                    </ThemedText>
                  ))}
                </ThemedView>
              ))
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loadingIndicator: { marginTop: Spacing.six },
  content: { padding: Spacing.three, gap: Spacing.three },
  emptyText: { textAlign: 'center', marginTop: Spacing.four },
  card: { borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.half },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
