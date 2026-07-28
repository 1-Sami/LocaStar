import {
  fetchBansByStatus,
  fetchProfile,
  issueBan,
  isModeratorRole,
  reviewBan,
  searchUsers,
  setUserRole,
  type ManagedUser,
  type UserBan,
  type UserRole,
} from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { confirmAsync } from '@/lib/confirm';
import { supabase } from '@/lib/supabase';

type Tab = 'people' | 'bans';

const DURATIONS: { label: string; days: number | null }[] = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: 'Lifetime', days: null },
];

function roleLabel(role: UserRole): string {
  if (role === 'admin') return 'Admin';
  if (role === 'superuser') return 'Superuser';
  return 'User';
}

function banExpiryLabel(ban: UserBan): string {
  if (!ban.expiresAt) return 'Lifetime';
  return `Until ${new Date(ban.expiresAt).toLocaleDateString()}`;
}

export default function AdminUsersScreen() {
  const { session } = useAuth();
  const theme = useTheme();

  const [myRole, setMyRole] = useState<UserRole>('user');
  const [tab, setTab] = useState<Tab>('people');
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<ManagedUser[]>([]);
  const [bans, setBans] = useState<UserBan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [banTarget, setBanTarget] = useState<ManagedUser | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banDays, setBanDays] = useState<number | null>(7);
  const [banError, setBanError] = useState<string | null>(null);

  const isAdmin = myRole === 'admin';

  const reload = useCallback(() => {
    if (!session) return;
    setLoading(true);
    Promise.all([
      fetchProfile(supabase, session.user.id),
      searchUsers(supabase, query),
      fetchBansByStatus(supabase, ['pending', 'active']),
    ])
      .then(([profile, users, banRows]) => {
        setMyRole(profile.role);
        setPeople(users);
        setBans(banRows);
      })
      .catch(() => {
        setPeople([]);
        setBans([]);
      })
      .finally(() => setLoading(false));
  }, [session, query]);

  useFocusEffect(useCallback(() => reload(), [reload]));

  const openBanSheet = (user: ManagedUser) => {
    setBanTarget(user);
    setBanReason('');
    setBanDays(7);
    setBanError(null);
  };

  const handleIssueBan = async () => {
    if (!session || !banTarget) return;
    if (!banReason.trim()) {
      setBanError('A reason is required — it is recorded in the audit log.');
      return;
    }
    setBusyId(banTarget.id);
    try {
      await issueBan(supabase, {
        userId: banTarget.id,
        issuedBy: session.user.id,
        reason: banReason.trim(),
        expiresAt: banDays === null ? null : new Date(Date.now() + banDays * 86400000).toISOString(),
        asAdmin: isAdmin,
      });
      setBanTarget(null);
      reload();
    } catch {
      setBanError('Could not issue that ban. Superusers cannot ban other moderators.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRoleChange = async (user: ManagedUser, role: UserRole) => {
    const granting = role === 'superuser';
    const confirmed = await confirmAsync(
      granting ? 'Make this person a Superuser?' : 'Remove Superuser?',
      granting
        ? `${user.name} will be able to handle reports, hide or remove content, and propose bans. Every action they take is logged.`
        : `${user.name} will lose access to reports and moderation tools.`,
      granting ? 'Grant' : 'Remove'
    );
    if (!confirmed) return;
    setBusyId(user.id);
    try {
      await setUserRole(supabase, user.id, role);
      reload();
    } finally {
      setBusyId(null);
    }
  };

  const handleReviewBan = async (ban: UserBan, status: 'active' | 'reversed' | 'lifted') => {
    if (!session) return;
    const labels = { active: 'Confirm this ban?', reversed: 'Reverse this ban?', lifted: 'Lift this ban?' };
    const confirmed = await confirmAsync(
      labels[status],
      status === 'reversed'
        ? `${ban.userName} will regain full access, and the ban will be marked as reversed.`
        : status === 'lifted'
          ? `${ban.userName} will regain full access from now on.`
          : `${ban.userName} stays restricted. ${banExpiryLabel(ban)}.`,
      'Confirm'
    );
    if (!confirmed) return;
    setBusyId(ban.id);
    try {
      await reviewBan(supabase, ban.id, status, session.user.id, null);
      reload();
    } finally {
      setBusyId(null);
    }
  };

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

  const pendingBans = bans.filter((b) => b.status === 'pending');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.tabRow}>
          <Pressable style={[styles.tab, tab === 'people' && styles.tabActive]} onPress={() => setTab('people')}>
            <ThemedText type="smallBold">People</ThemedText>
          </Pressable>
          <Pressable style={[styles.tab, tab === 'bans' && styles.tabActive]} onPress={() => setTab('bans')}>
            <ThemedText type="smallBold">
              Bans{pendingBans.length > 0 ? ` (${pendingBans.length})` : ''}
            </ThemedText>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator style={styles.loadingIndicator} />
        ) : tab === 'people' ? (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={[styles.searchBar, { borderColor: theme.backgroundSelected }]}>
              <Ionicons name="search" size={16} color={theme.textSecondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search by username or name"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                style={[styles.searchInput, { color: theme.text }]}
              />
            </View>

            {people.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                No people match that search.
              </ThemedText>
            ) : (
              people.map((user) => {
                const busy = busyId === user.id;
                const isSelf = user.id === session.user.id;
                return (
                  <ThemedView key={user.id} type="backgroundElement" style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderText}>
                        <ThemedText type="smallBold">{user.name}</ThemedText>
                        {user.username && (
                          <ThemedText type="small" themeColor="textSecondary">
                            @{user.username}
                          </ThemedText>
                        )}
                      </View>
                      <View style={styles.badgeRow}>
                        {user.isBanned && (
                          <View style={[styles.badge, styles.bannedBadge]}>
                            <ThemedText type="small" style={styles.badgeTextLight}>
                              Banned
                            </ThemedText>
                          </View>
                        )}
                        <View style={[styles.badge, user.role !== 'user' && styles.roleBadge]}>
                          <ThemedText type="small" style={user.role !== 'user' ? styles.badgeTextLight : undefined}>
                            {roleLabel(user.role)}
                          </ThemedText>
                        </View>
                      </View>
                    </View>

                    {!isSelf && (
                      <View style={styles.actionsRow}>
                        {isAdmin && user.role !== 'admin' && (
                          <Pressable
                            style={[styles.actionButton, styles.neutralButton]}
                            disabled={busy}
                            onPress={() => handleRoleChange(user, user.role === 'superuser' ? 'user' : 'superuser')}>
                            <ThemedText type="small">
                              {user.role === 'superuser' ? 'Remove Superuser' : 'Make Superuser'}
                            </ThemedText>
                          </Pressable>
                        )}
                        {!user.isBanned && user.role !== 'admin' && (
                          <Pressable
                            style={[styles.actionButton, styles.dangerButton]}
                            disabled={busy}
                            onPress={() => openBanSheet(user)}>
                            <ThemedText type="small" style={styles.badgeTextLight}>
                              Ban
                            </ThemedText>
                          </Pressable>
                        )}
                      </View>
                    )}
                  </ThemedView>
                );
              })
            )}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {bans.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                No active or pending bans.
              </ThemedText>
            ) : (
              bans.map((ban) => {
                const busy = busyId === ban.id;
                return (
                  <ThemedView key={ban.id} type="backgroundElement" style={styles.card}>
                    <View style={styles.cardHeader}>
                      <ThemedText type="smallBold">{ban.userName}</ThemedText>
                      <View
                        style={[styles.badge, ban.status === 'pending' ? styles.pendingBadge : styles.bannedBadge]}>
                        <ThemedText type="small" style={styles.badgeTextLight}>
                          {ban.status === 'pending' ? 'Awaiting review' : 'Active'}
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      {banExpiryLabel(ban)} · by {ban.issuedByName} ·{' '}
                      {new Date(ban.createdAt).toLocaleDateString()}
                    </ThemedText>
                    <ThemedText type="default" style={styles.reason}>
                      {ban.reason}
                    </ThemedText>

                    {ban.status === 'pending' && !isAdmin && (
                      <ThemedText type="small" themeColor="textSecondary">
                        Already in effect. An admin has to confirm it.
                      </ThemedText>
                    )}

                    {isAdmin && (
                      <View style={styles.actionsRow}>
                        {ban.status === 'pending' && (
                          <Pressable
                            style={[styles.actionButton, styles.confirmButton]}
                            disabled={busy}
                            onPress={() => handleReviewBan(ban, 'active')}>
                            <ThemedText type="small" style={styles.badgeTextDark}>
                              Confirm
                            </ThemedText>
                          </Pressable>
                        )}
                        <Pressable
                          style={[styles.actionButton, styles.neutralButton]}
                          disabled={busy}
                          onPress={() => handleReviewBan(ban, ban.status === 'pending' ? 'reversed' : 'lifted')}>
                          <ThemedText type="small">{ban.status === 'pending' ? 'Reverse' : 'Lift'}</ThemedText>
                        </Pressable>
                      </View>
                    )}
                  </ThemedView>
                );
              })
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      <Modal visible={banTarget !== null} animationType="slide" transparent onRequestClose={() => setBanTarget(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setBanTarget(null)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <ThemedView type="backgroundElement" style={styles.modalInner}>
              <ThemedText type="subtitle" style={styles.modalTitle}>
                Ban {banTarget?.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {isAdmin
                  ? 'Takes effect immediately.'
                  : 'Takes effect immediately, and stays pending until an admin confirms it.'}
              </ThemedText>

              <ThemedText type="smallBold" style={styles.fieldLabel}>
                Duration
              </ThemedText>
              <View style={styles.durationRow}>
                {DURATIONS.map((option) => (
                  <Pressable
                    key={option.label}
                    style={[
                      styles.durationChip,
                      { borderColor: theme.backgroundSelected },
                      banDays === option.days && styles.durationChipActive,
                    ]}
                    onPress={() => setBanDays(option.days)}>
                    <ThemedText type="small" style={banDays === option.days ? styles.badgeTextDark : undefined}>
                      {option.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <ThemedText type="smallBold" style={styles.fieldLabel}>
                Reason
              </ThemedText>
              <TextInput
                value={banReason}
                onChangeText={(text) => {
                  setBanReason(text);
                  setBanError(null);
                }}
                placeholder="Why is this person being banned?"
                placeholderTextColor={theme.textSecondary}
                multiline
                style={[styles.reasonInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
              />

              {banError && (
                <ThemedText type="small" style={styles.errorText}>
                  {banError}
                </ThemedText>
              )}

              <Pressable
                style={[styles.submitButton, !banReason.trim() && styles.submitButtonDisabled]}
                disabled={!banReason.trim() || busyId !== null}
                onPress={handleIssueBan}>
                <ThemedText type="smallBold" style={styles.badgeTextLight}>
                  Ban this person
                </ThemedText>
              </Pressable>
            </ThemedView>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  tabRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    alignItems: 'center',
    backgroundColor: 'rgba(128,128,128,0.15)',
  },
  tabActive: { backgroundColor: 'rgba(20,116,122,0.3)' },
  loadingIndicator: { marginTop: Spacing.six },
  content: { padding: Spacing.three, gap: Spacing.three },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 16 },
  emptyText: { textAlign: 'center', marginTop: Spacing.four },
  card: { borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.one },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  cardHeaderText: { flexShrink: 1 },
  badgeRow: { flexDirection: 'row', gap: Spacing.one, alignItems: 'center' },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.five,
    backgroundColor: 'rgba(128,128,128,0.25)',
  },
  roleBadge: { backgroundColor: '#14747A' },
  bannedBadge: { backgroundColor: '#E05252' },
  pendingBadge: { backgroundColor: '#E8A93B' },
  badgeTextLight: { color: '#ffffff' },
  badgeTextDark: { color: '#1A1400' },
  reason: { marginTop: Spacing.one },
  actionsRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  actionButton: {
    flex: 1,
    height: 38,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },
  neutralButton: { backgroundColor: 'rgba(128,128,128,0.25)' },
  dangerButton: { backgroundColor: '#E05252' },
  confirmButton: { backgroundColor: '#E8A93B' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { maxHeight: '85%' },
  modalInner: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  modalTitle: { fontSize: 20, lineHeight: 26 },
  fieldLabel: { marginTop: Spacing.two },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  durationChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  durationChipActive: { backgroundColor: '#E8A93B', borderColor: '#E8A93B' },
  reasonInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    height: 90,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  errorText: { color: '#E05252' },
  submitButton: {
    height: 48,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E05252',
    marginTop: Spacing.two,
  },
  submitButtonDisabled: { opacity: 0.5 },
});
