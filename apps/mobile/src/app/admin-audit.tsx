import {
  fetchModerationActions,
  fetchProfile,
  isModeratorRole,
  type ModerationAction,
  type UserRole,
} from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
  photo_deleted: 'Photo taken down',
};

const ACTION_COLORS: Record<string, string> = {
  ban_issued: '#E05252',
  ban_reviewed: '#E8A93B',
  role_changed: '#4C8FE8',
  warning_issued: '#E8A93B',
  location_status_changed: '#C34CE8',
  review_status_changed: '#C34CE8',
  report_resolved: '#4CD37A',
  photo_deleted: '#C34CE8',
};

/*
 * The groups the chips filter by.
 *
 * Fewer than there are action types on purpose: somebody scanning this wants
 * "what got taken down" or "what happened to people", not a checkbox per
 * database enum.
 */
const FILTERS: { key: string; label: string; actions: string[] }[] = [
  { key: 'all', label: 'All', actions: [] },
  { key: 'takedowns', label: 'Takedowns', actions: ['location_status_changed', 'review_status_changed', 'photo_deleted'] },
  { key: 'reports', label: 'Reports', actions: ['report_resolved'] },
  { key: 'people', label: 'People', actions: ['ban_issued', 'ban_reviewed', 'warning_issued', 'role_changed'] },
];

/** What the entry is about, in words rather than a table name. */
const TARGET_LABELS: Record<string, string> = {
  review: 'a review',
  location: 'a place',
  review_report: 'a report about a review',
  location_report: 'a report about a place',
  profile: 'an account',
  user: 'an account',
  review_photo: 'a photo on a review',
  location_photo: 'a photo on a place',
  user_ban: 'a ban',
  user_warning: 'a warning',
};

function roleLabel(role: UserRole | null): string {
  if (role === 'admin') return 'Admin';
  if (role === 'superuser') return 'Superuser';
  return 'User';
}

// The decision a moderator recorded when resolving a report.
const RESOLUTION_LABELS: Record<string, string> = {
  dismissed: 'Dismissed the report',
  warned: 'Warned the author',
  hidden: 'Hid the content',
  removed: 'Removed the content',
};

const DETAIL_LABELS: Record<string, string> = {
  action: 'Action',
  author: 'Posted by',
  note: 'Reason given',
  reason: 'Reason given',
  status: 'Status',
  expires_at: 'Expires',
};

function formatDetailValue(key: string, value: unknown, names: Record<string, string>): string {
  // The log stores ids so an entry keeps its meaning when a name changes; the
  // name is what a person can actually act on, so it is shown instead.
  const named = names[String(value)];
  if (named) return named;
  if (key === 'action') return RESOLUTION_LABELS[String(value)] ?? String(value);
  // Quote free text so it reads as someone's words rather than a field value.
  if (key === 'note' || key === 'reason') return `“${String(value)}”`;
  return String(value);
}

/** Renders the jsonb detail as "from → to" where present, else labelled lines. */
function detailLines(detail: Record<string, unknown> | null, names: Record<string, string>): string[] {
  if (!detail) return [];
  const lines: string[] = [];
  if (detail.from !== undefined || detail.to !== undefined) {
    lines.push(`${String(detail.from ?? '—')} → ${String(detail.to ?? '—')}`);
  }
  for (const [key, value] of Object.entries(detail)) {
    if (key === 'from' || key === 'to' || value === null || value === undefined) continue;
    if (key.endsWith('_id')) continue;
    const label = DETAIL_LABELS[key] ?? key.replace(/_/g, ' ');
    lines.push(`${label}: ${formatDetailValue(key, value, names)}`);
  }
  return lines;
}

/** Everything about an entry that somebody might search for, lower-cased. */
function searchableText(entry: ModerationAction): string {
  return [
    entry.actorName,
    ACTION_LABELS[entry.action] ?? entry.action,
    TARGET_LABELS[entry.targetType] ?? entry.targetType,
    entry.subject ?? '',
    ...detailLines(entry.detail, entry.names),
  ]
    .join(' ')
    .toLowerCase();
}

export default function AdminAuditScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [actions, setActions] = useState<ModerationAction[]>([]);
  const [myRole, setMyRole] = useState<UserRole>('user');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const theme = useTheme();

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
            {t('admin.noAccess')}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const trimmed = query.trim().toLowerCase();
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const visible = actions
    .filter((entry) => active.actions.length === 0 || active.actions.includes(entry.action))
    .filter((entry) => !trimmed || searchableText(entry).includes(trimmed));

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

            <View style={[styles.searchBar, { borderColor: theme.fieldBorder }]}>
              <Ionicons name="search" size={16} color={theme.textSecondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('admin.searchLog')}
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.searchInput, { color: theme.text }]}
              />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filterRow}>
              {FILTERS.map((option) => (
                <Pressable
                  key={option.key}
                  onPress={() => setFilter(option.key)}
                  style={[
                    styles.filterChip,
                    { borderColor: theme.fieldBorder },
                    filter === option.key && styles.filterChipActive,
                  ]}>
                  <ThemedText type="small" style={filter === option.key ? styles.filterChipTextActive : undefined}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            {actions.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                {t('admin.nothingLogged')}
              </ThemedText>
            ) : visible.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                {t('admin.noLogMatch')}
              </ThemedText>
            ) : (
              visible.map((entry) => (
                <ThemedView key={entry.id} type="backgroundElement" style={styles.card}>
                  <View style={styles.cardHeader}>
                    <ThemedText type="smallBold" style={{ color: ACTION_COLORS[entry.action] ?? undefined }}>
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {new Date(entry.createdAt).toLocaleString()}
                    </ThemedText>
                  </View>
                  <ThemedText type="small" style={styles.detailLine}>
                    {entry.subject ?? `${TARGET_LABELS[entry.targetType] ?? entry.targetType} (no longer exists)`}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {entry.actorName} · {roleLabel(entry.actorRole)}
                  </ThemedText>
                  {detailLines(entry.detail, entry.names).map((line, index) => (
                    <ThemedText key={index} type="small" style={styles.detailLine}>
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
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  loadingIndicator: { marginTop: Spacing.six },
  content: { padding: Spacing.three, gap: Spacing.three },
  emptyText: { textAlign: 'center', marginTop: Spacing.four },
  card: { borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.half },
  // Full contrast: this is the line saying what actually changed, and it was
  // rendering a shade below the metadata above it.
  detailLine: { opacity: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 16 },
  filterScroll: { flexGrow: 0 },
  filterRow: { flexDirection: 'row', gap: Spacing.two, paddingVertical: Spacing.one },
  filterChip: {
    borderWidth: 1,
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  filterChipActive: { backgroundColor: '#E8A93B', borderColor: '#E8A93B' },
  filterChipTextActive: { color: '#1A1400', fontWeight: '700' },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
