import {
  deleteFeedback,
  fetchFeedback,
  fetchFeedbackAssignees,
  fetchProfile,
  setFeedbackAssignee,
  setFeedbackDone,
  type FeedbackAssignee,
  type FeedbackCategory,
  type FeedbackRow,
  type UserRole,
} from '@locastar/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SheetRoot } from '@/components/sheet-root';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { confirmAsync } from '@/lib/confirm';
import { supabase } from '@/lib/supabase';

/**
 * What people have asked for, and what is being done about it.
 *
 * Nothing here names the sender, because nothing about them was ever written
 * down — see migration 0120 — so there is still no reply control and never
 * will be. What changed is the rest: this was "a list to read, not a queue to
 * work through", which held at four messages and stopped holding once the same
 * request arrived twice with no way to say handled, or whose it was.
 *
 * Superusers can open it now, which 0120 deliberately prevented. The line
 * moved only as far as it had to: a superuser sees the items assigned to them
 * and nothing else, and that is enforced by RLS (0160) rather than by this
 * screen. The queue as a whole is still admin-only.
 *
 * Flat rather than grouped by category. Crash reports group by message because
 * one crash hitting two hundred people is a single thing to fix; two people
 * asking for the same feature in their own words is two data points, and
 * collapsing them would hide exactly the repetition worth noticing. Done items
 * do drop to the bottom, because a handled one has stopped competing for
 * attention with the ones that have not.
 */
const CATEGORY_COLORS: Record<FeedbackCategory, string> = {
  general: '#4C8FE8',
  feature_request: '#4CD37A',
  feature_removal: '#E8A93B',
};

export default function FeedbackInboxScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const theme = useTheme();
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [assignees, setAssignees] = useState<FeedbackAssignee[]>([]);
  const [role, setRole] = useState<UserRole>('user');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  /** The row whose assignee picker is open. */
  const [assigning, setAssigning] = useState<FeedbackRow | null>(null);
  /** The row a request is in flight for, so its buttons can stop taking taps. */
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionFailed, setActionFailed] = useState(false);

  const isAdmin = role === 'admin';

  const load = useCallback(async () => {
    if (!session) return;
    const profile = await fetchProfile(supabase, session.user.id);
    setRole(profile.role);
    const [feedback, team] = await Promise.all([
      fetchFeedback(supabase),
      // Only an admin may hand work out, so only an admin needs the list.
      profile.role === 'admin' ? fetchFeedbackAssignees(supabase) : Promise.resolve([]),
    ]);
    setRows(feedback);
    setAssignees(team);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setLoadFailed(false);
      load()
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
    }, [load])
  );

  /*
   * Every action re-reads the list rather than patching the row in place.
   *
   * RLS can refuse — a superuser closing something that was reassigned out
   * from under them, say — and an optimistic update would then show a state
   * the database never agreed to. Re-reading is one extra request on a screen
   * nobody opens in a loop.
   */
  const run = useCallback(
    async (id: string, work: () => Promise<void>) => {
      setBusyId(id);
      setActionFailed(false);
      try {
        await work();
        await load();
      } catch (err) {
        console.error('Feedback action failed', err);
        setActionFailed(true);
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  const toggleDone = (row: FeedbackRow) =>
    run(row.id, () => setFeedbackDone(supabase, row.id, row.doneAt === null));

  const assign = (row: FeedbackRow, to: string | null) => {
    setAssigning(null);
    return run(row.id, () => setFeedbackAssignee(supabase, row.id, to));
  };

  const remove = async (row: FeedbackRow) => {
    const confirmed = await confirmAsync(
      t('feedback.inboxDeleteTitle'),
      t('feedback.inboxDeleteBody'),
      t('feedback.inboxDelete')
    );
    if (!confirmed) return;
    await run(row.id, () => deleteFeedback(supabase, row.id));
  };

  if (!session || (!loading && role !== 'admin' && role !== 'superuser')) {
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

  const open = rows.filter((row) => row.doneAt === null);
  const done = rows.filter((row) => row.doneAt !== null);

  const card = (row: FeedbackRow) => (
    <ThemedView
      key={row.id}
      type="backgroundElement"
      style={[styles.card, row.doneAt !== null && styles.cardDone]}>
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
        {row.assignedToName ? ` · ${t('feedback.inboxAssignedTo', { name: row.assignedToName })}` : ''}
      </ThemedText>

      <View style={styles.actions}>
        <Pressable
          style={[styles.btn, { borderColor: theme.backgroundSelected }]}
          disabled={busyId === row.id}
          onPress={() => toggleDone(row)}>
          <ThemedText type="small">
            {row.doneAt === null ? t('feedback.inboxDone') : t('feedback.inboxReopen')}
          </ThemedText>
        </Pressable>

        {isAdmin && (
          <Pressable
            style={[styles.btn, { borderColor: theme.backgroundSelected }]}
            disabled={busyId === row.id}
            onPress={() => setAssigning(row)}>
            <ThemedText type="small">{t('feedback.inboxAssign')}</ThemedText>
          </Pressable>
        )}

        {isAdmin && (
          <Pressable
            style={[styles.btn, styles.btnDanger]}
            disabled={busyId === row.id}
            onPress={() => remove(row)}>
            <ThemedText type="small" style={styles.dangerText}>
              {t('feedback.inboxDelete')}
            </ThemedText>
          </Pressable>
        )}

        {busyId === row.id && <ActivityIndicator size="small" />}
      </View>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        {loading ? (
          <ActivityIndicator style={styles.loadingIndicator} />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {!isAdmin && (
              <ThemedText type="small" themeColor="textSecondary">
                {t('feedback.inboxMineOnly')}
              </ThemedText>
            )}
            {actionFailed && (
              <ThemedText type="small" style={styles.dangerText}>
                {t('feedback.inboxActionFailed')}
              </ThemedText>
            )}

            {loadFailed ? (
              <ThemedText type="default" themeColor="textSecondary" style={styles.centerText}>
                {t('common.somethingWentWrong')}
              </ThemedText>
            ) : rows.length === 0 ? (
              <ThemedText type="default" themeColor="textSecondary" style={styles.centerText}>
                {t('feedback.empty')}
              </ThemedText>
            ) : (
              <>
                {open.map(card)}
                {done.length > 0 && (
                  <>
                    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.groupLabel}>
                      {t('feedback.inboxDoneGroup')} · {done.length}
                    </ThemedText>
                    {done.map(card)}
                  </>
                )}
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      <Modal
        visible={assigning !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setAssigning(null)}>
        <SheetRoot>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAssigning(null)} />
          {assigning && (
            <ThemedView type="backgroundElement" style={styles.sheet}>
              <ThemedText type="subtitle">{t('feedback.inboxAssignTitle')}</ThemedText>
              <Pressable style={styles.sheetRow} onPress={() => assign(assigning, null)}>
                <ThemedText type="default" themeColor="textSecondary">
                  {t('feedback.inboxUnassigned')}
                </ThemedText>
              </Pressable>
              {assignees.map((person) => (
                <Pressable
                  key={person.id}
                  style={styles.sheetRow}
                  onPress={() => assign(assigning, person.id)}>
                  <ThemedText type="default">{person.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {person.role}
                  </ThemedText>
                </Pressable>
              ))}
            </ThemedView>
          )}
        </SheetRoot>
      </Modal>
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
  /* Handled, and still readable — the question somebody eventually asks is
     "did we ever do anything about X". */
  cardDone: { opacity: 0.6 },
  groupLabel: { marginTop: Spacing.three },
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
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  btn: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.one,
    borderWidth: 1,
  },
  /* Outlined, not filled: deleting is rare and should not be the loudest
     thing on a card whose point is the sentence above it. */
  btnDanger: { borderColor: 'rgba(192,57,43,0.5)' },
  dangerText: { color: '#C0392B' },
  sheet: {
    borderTopLeftRadius: Spacing.three,
    borderTopRightRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
});
