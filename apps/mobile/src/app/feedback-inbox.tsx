import { fetchFeedback, fetchProfile, type FeedbackCategory, type FeedbackRow, type UserRole } from '@locastar/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

/**
 * What people have asked for, newest first.
 *
 * Nothing here names anybody, because nothing about them was ever written
 * down — see migration 0120. There is no reply control for the same reason,
 * and no resolve control either: this is a list to read before deciding what
 * to build, not a queue to work through. Admin-only, like the crash reports.
 *
 * Flat rather than grouped. Crash reports group by message because one crash
 * hitting two hundred people is a single thing to fix; two people asking for
 * the same feature in their own words is two data points, and collapsing them
 * would hide exactly the repetition worth noticing.
 */
const CATEGORY_COLORS: Record<FeedbackCategory, string> = {
  general: '#4C8FE8',
  feature_request: '#4CD37A',
  feature_removal: '#E8A93B',
};

export default function FeedbackInboxScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [role, setRole] = useState<UserRole>('user');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let cancelled = false;
      setLoading(true);
      setLoadFailed(false);
      Promise.all([fetchProfile(supabase, session.user.id), fetchFeedback(supabase)])
        .then(([profile, feedback]) => {
          if (cancelled) return;
          setRole(profile.role);
          setRows(feedback);
        })
        .catch((err) => {
          // An empty list here would read as "nobody has said anything", which
          // is the one thing this screen must never claim wrongly.
          console.error('Failed to load feedback', err);
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
            ) : rows.length === 0 ? (
              <ThemedText type="default" themeColor="textSecondary" style={styles.centerText}>
                {t('feedback.empty')}
              </ThemedText>
            ) : (
              rows.map((row) => (
                <ThemedView key={row.id} type="backgroundElement" style={styles.card}>
                  <View style={styles.headerRow}>
                    <View style={[styles.categoryPill, { backgroundColor: `${CATEGORY_COLORS[row.category]}33` }]}>
                      <ThemedText type="small" style={[styles.categoryText, { color: CATEGORY_COLORS[row.category] }]}>
                        {t(`feedback.category.${row.category}`)}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      {row.appRelease} · {row.platform}
                    </ThemedText>
                  </View>
                  <ThemedText type="default" style={styles.message}>
                    {row.message}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {new Date(row.createdAt).toLocaleString()}
                  </ThemedText>
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
  card: { borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.two },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  categoryPill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.one,
  },
  categoryText: { fontWeight: '700' },
  message: { lineHeight: 21 },
});
