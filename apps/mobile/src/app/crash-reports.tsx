import { fetchCrashReports, fetchProfile, type CrashReportRow, type UserRole } from '@locastar/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { APP_RELEASE } from '@/constants/release';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

/**
 * What broke, and whether it is still breaking.
 *
 * Grouped by message rather than listed flat. One crash hitting two hundred
 * people is a single thing to fix and would otherwise fill the screen and hide
 * everything else; the count is the part that says how much it matters.
 *
 * Admin-only, matching the moderation log. Crash reports carry no personal data
 * by design, but a list of what is broken and on which build is not something
 * to hand to everyone either.
 */
type Group = {
  message: string;
  count: number;
  latest: CrashReportRow;
  releases: string[];
  stillOnThisRelease: boolean;
};

function groupByMessage(rows: CrashReportRow[]): Group[] {
  const byMessage = new Map<string, CrashReportRow[]>();
  for (const row of rows) {
    const existing = byMessage.get(row.message);
    if (existing) existing.push(row);
    else byMessage.set(row.message, [row]);
  }
  return [...byMessage.values()]
    .map((group) => ({
      message: group[0].message,
      count: group.length,
      // The rows arrive newest first, so the first of each group is the latest.
      latest: group[0],
      releases: [...new Set(group.map((r) => r.appRelease))],
      // The question that decides whether it still needs fixing.
      stillOnThisRelease: group.some((r) => r.appRelease === APP_RELEASE),
    }))
    .sort((a, b) => b.count - a.count);
}

export default function CrashReportsScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [rows, setRows] = useState<CrashReportRow[]>([]);
  const [role, setRole] = useState<UserRole>('user');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let cancelled = false;
      setLoading(true);
      setLoadFailed(false);
      Promise.all([fetchProfile(supabase, session.user.id), fetchCrashReports(supabase)])
        .then(([profile, reports]) => {
          if (cancelled) return;
          setRole(profile.role);
          setRows(reports);
        })
        .catch((err) => {
          // An empty list here would read as "nothing has crashed", which is
          // the single most misleading thing this screen could say.
          console.error('Failed to load crash reports', err);
          if (!cancelled) setLoadFailed(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [session])
  );

  if (!session || (!loading && role !== 'admin')) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <ThemedText type="default" themeColor="textSecondary" style={styles.centerText}>
            {t('admin.noAccess')}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const groups = groupByMessage(rows);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        {loading ? (
          <ActivityIndicator style={styles.loadingIndicator} />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {loadFailed ? (
              <ThemedText type="default" themeColor="textSecondary" style={styles.centerText}>
                {t('common.somethingWentWrong')}
              </ThemedText>
            ) : groups.length === 0 ? (
              <ThemedText type="default" themeColor="textSecondary" style={styles.centerText}>
                {t('crashes.empty')}
              </ThemedText>
            ) : (
              groups.map((group) => (
                <ThemedView key={group.message} type="backgroundElement" style={styles.card}>
                  <View style={styles.headerRow}>
                    <ThemedText type="smallBold" style={styles.message}>
                      {group.message}
                    </ThemedText>
                    <View style={[styles.countPill, group.stillOnThisRelease && styles.countPillCurrent]}>
                      <ThemedText type="small" style={styles.countText}>
                        {group.count}
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('crashes.seenOn', { releases: group.releases.join(', ') })}
                    {group.stillOnThisRelease ? ` · ${t('crashes.currentRelease')}` : ''}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {group.latest.platform}
                    {group.latest.osVersion ? ` ${group.latest.osVersion}` : ''}
                    {group.latest.route ? ` · ${group.latest.route}` : ''}
                    {' · '}
                    {new Date(group.latest.createdAt).toLocaleString()}
                  </ThemedText>
                  {group.latest.stack && (
                    <ThemedText type="small" themeColor="textSecondary" style={styles.stack} numberOfLines={6}>
                      {group.latest.stack}
                    </ThemedText>
                  )}
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
  centerText: { textAlign: 'center', marginTop: Spacing.six },
  card: { borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.one },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  message: { flex: 1 },
  countPill: {
    minWidth: 26,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.five,
    backgroundColor: 'rgba(128,128,128,0.3)',
    alignItems: 'center',
  },
  // Red only when it is still happening on the build people are running.
  countPillCurrent: { backgroundColor: '#E05252' },
  countText: { color: '#ffffff', fontWeight: '700' },
  stack: {
    marginTop: Spacing.one,
    fontSize: 11,
    lineHeight: 15,
    opacity: 0.8,
  },
});
