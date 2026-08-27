import {
  acknowledgeWarning,
  fetchMyActiveBan,
  fetchOpenReportsCount,
  fetchPendingFriendRequestCount,
  fetchProfile,
  fetchProfileStats,
  fetchWarningsForUser,
  isModeratorRole,
  type ProfileStats,
  type UserBan,
  type UserRole,
  type UserWarning,
} from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { MenuRow, MENU_ROW_WIDTH } from '@/components/menu-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { MenuId } from '@/constants/menu-icons';
import { SUPPORT_EMAIL } from '@/constants/support';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { confirmAsync } from '@/lib/confirm';
import { useNotificationsBadge } from '@/lib/notifications-context';
import { supabase } from '@/lib/supabase';

const EMPTY_STATS: ProfileStats = {
  favorites: 0,
  bucketList: 0,
  shared: 0,
  reviews: 0,
  added: 0,
  lists: 0,
  activities: 0,
  contributions: 0,
};

/*
 * The five tiles are measured to fill the row rather than being given a fixed
 * width.
 *
 * They were 59pt each with 10pt between them, which left a gap at the right
 * edge on every phone and made the numbers — the only part anyone reads — the
 * smallest thing on the screen. There are always exactly five, so the width
 * they should be is arithmetic, not a guess: whatever is left after the gaps,
 * divided by five. Capped at MaxContentWidth so a tablet gets five sensible
 * tiles instead of five very wide ones.
 */
const STAT_TILE_COUNT = 5;
const STAT_TILE_GAP = 6;

/*
 * Stat tiles and menu rows are identified by id and *labelled* by translation.
 *
 * They used to be the same string: the label was the array element, the routing
 * compared against it, and MENU_ICONS was keyed by it. That works exactly until
 * the labels are translated, at which point every comparison misses and the
 * menu silently stops navigating anywhere. Nothing throws — the row just does
 * nothing when tapped.
 */
type StatId = 'favorites' | 'bucketList' | 'shared' | 'reviews' | 'added';

function statTiles(stats: ProfileStats): { id: StatId; value: number; color: string }[] {
  return [
    { id: 'favorites', value: stats.favorites, color: '#E8A93B' },
    { id: 'bucketList', value: stats.bucketList, color: '#4C8FE8' },
    { id: 'shared', value: stats.shared, color: '#B0B4BA' },
    { id: 'reviews', value: stats.reviews, color: '#4CD37A' },
    { id: 'added', value: stats.added, color: '#C34CE8' },
  ];
}

const STAT_LABELS: Record<StatId, string> = {
  favorites: 'profile.statFavorites',
  bucketList: 'profile.statBucketList',
  shared: 'profile.statShared',
  reviews: 'profile.statReviews',
  added: 'profile.statAdded',
};

/** The three that open the Saved screen at a particular section. */
const STAT_SECTIONS: Partial<Record<StatId, string>> = {
  favorites: 'favorites',
  bucketList: 'bucketList',
  shared: 'shared',
};

// "My reviews" is deliberately absent: the Reviews stat tile directly above
// already goes there, and two controls a centimetre apart leading to the same
// screen reads as a mistake rather than a convenience.
const PRIMARY_MENU_ITEMS: MenuId[] = ['myLists', 'friends', 'addLocation', 'addActivity'];
const SECONDARY_MENU_ITEMS: MenuId[] = ['settings', 'about'];
// Its own group rather than an entry in the list above, because that list is
// deliberately shared with the signed-out branch and this needs an account.
// Not for the account's sake — feedback is stored with nothing identifying on
// it — but because requiring one is the whole of the spam defence.
const ACCOUNT_MENU_ITEMS: MenuId[] = ['sendFeedback'];

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();
  const { unreadCount } = useNotificationsBadge();
  const { width: windowWidth } = useWindowDimensions();

  // See STAT_TILE_GAP. useWindowDimensions rather than Dimensions.get so the
  // row re-measures if the window ever changes size under it.
  const statRowWidth = Math.min(windowWidth, MaxContentWidth) - Spacing.three * 2;
  const statTileWidth = Math.floor(
    (statRowWidth - STAT_TILE_GAP * (STAT_TILE_COUNT - 1)) / STAT_TILE_COUNT
  );
  const [stats, setStats] = useState<ProfileStats>(EMPTY_STATS);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [myRole, setMyRole] = useState<UserRole>('user');
  const [openReportsCount, setOpenReportsCount] = useState(0);
  const [pendingFriendRequests, setPendingFriendRequests] = useState(0);
  const [myBan, setMyBan] = useState<UserBan | null>(null);
  const [myWarnings, setMyWarnings] = useState<UserWarning[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let cancelled = false;
      fetchProfileStats(supabase, session.user.id)
        .then((result) => {
          if (!cancelled) setStats(result);
        })
        .catch((err) => {
          // Not EMPTY_STATS: zeroing asserts this person has contributed
          // nothing, which is a statement about them rather than about the
          // request. Leave whatever was last known standing.
          console.error('Failed to load profile stats', err);
        });
      fetchMyActiveBan(supabase, session.user.id)
        .then((ban) => {
          if (!cancelled) setMyBan(ban);
        })
        .catch((err) => {
          // The ban itself is enforced in the database, so losing this only
          // costs the banner explaining why things are refusing to work.
          console.error('Failed to load your ban status', err);
        });
      fetchPendingFriendRequestCount(supabase, session.user.id)
        .then((count) => {
          if (!cancelled) setPendingFriendRequests(count);
        })
        .catch(() => {
          if (!cancelled) setPendingFriendRequests(0);
        });
      fetchWarningsForUser(supabase, session.user.id)
        .then((warnings) => {
          // Only unacknowledged ones need the user's attention.
          if (!cancelled) setMyWarnings(warnings.filter((w) => !w.acknowledgedAt));
        })
        .catch(() => {});
      fetchProfile(supabase, session.user.id)
        .then((profile) => {
          if (cancelled) return;
          setAvatarUrl(profile.avatar_url);
          setUsername(profile.username);
          setMyRole(profile.role);
          // Superusers moderate too, so the reports queue isn't admin-only.
          const moderator = isModeratorRole(profile.role);
          setIsModerator(moderator);
          if (moderator) {
            fetchOpenReportsCount(supabase)
              .then((count) => {
                if (!cancelled) setOpenReportsCount(count);
              })
              .catch(() => {
                if (!cancelled) setOpenReportsCount(0);
              });
          }
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [session])
  );

  const handleSignOut = async () => {
    const confirmed = await confirmAsync(
      t('profile.logOutConfirmTitle'),
      t('profile.logOutConfirmBody'),
      t('common.logOut')
    );
    if (confirmed) signOut();
  };

  const handleMenuPress = (item: MenuId) => {
    if (item === 'myLists') router.push('/lists' as never);
    if (item === 'friends') router.push('/friends' as never);
    if (item === 'addLocation') router.push({ pathname: '/add-location', params: { kind: 'place' } });
    if (item === 'addActivity') router.push({ pathname: '/add-location', params: { kind: 'activity' } });
    if (item === 'settings') router.push('/settings' as never);
    if (item === 'about') router.push('/about');
    if (item === 'sendFeedback') router.push('/send-feedback' as never);
    if (item === 'admin') router.push('/admin' as never);
  };

  const handleStatPress = (id: StatId) => {
    if (id === 'reviews') {
      router.push('/my-reviews');
      return;
    }
    if (id === 'added') {
      router.push('/my-locations' as never);
      return;
    }
    const section = STAT_SECTIONS[id];
    if (section) {
      router.push({ pathname: '/favorites', params: { section } });
    }
  };

  if (!session) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <ThemedText type="subtitle" style={styles.header}>
            {t('profile.title')}
          </ThemedText>
          <View style={styles.loggedOutPrompt}>
            <ThemedText type="default" themeColor="textSecondary" style={styles.centerText}>
              {t('profile.loggedOutPrompt')}
            </ThemedText>
            <Pressable style={styles.primaryButton} onPress={() => router.push('/sign-in')}>
              <ThemedText type="smallBold" style={styles.primaryButtonText}>
                {t('common.logIn')}
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => router.push('/sign-up')}>
              <ThemedText type="linkPrimary">{t('common.createAccount')}</ThemedText>
            </Pressable>
          </View>
          {/* Both are available logged out. About explains what the app is
              for and carries the Privacy Policy / Terms links; Settings holds
              language and theme, readable in the right language before
              handing over an email address. The rows that need an account
              hide themselves.

              Deliberately the same list the signed-in branch renders, so the
              two cannot drift apart. */}
          <View style={[styles.menu, styles.loggedOutMenu]}>
            {SECONDARY_MENU_ITEMS.map((item) => (
              <MenuRow key={item} item={item} onPress={() => handleMenuPress(item)} />
            ))}
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* The bell used to sit on a row of its own above this one, which
            pushed the avatar down the screen and left the bell stranded near
            the status bar with nothing beside it. In the profile row it lines
            up with the top of the avatar and the space it was occupying goes
            back to the content. */}
        <View style={styles.profileRow}>
          <Pressable onPress={() => router.push('/settings/profile-picture' as never)}>
            <Avatar url={avatarUrl} size={82} />
          </Pressable>
          <View style={styles.infoColumn}>
            <View style={styles.usernameRow}>
              {username && <ThemedText style={styles.usernameText}>{username}</ThemedText>}
              {myRole !== 'user' && (
                <View style={[styles.roleBadge, myRole === 'admin' && styles.adminBadge]}>
                  <Ionicons name="shield-checkmark" size={11} color="#1A1400" />
                  <ThemedText type="small" style={styles.roleBadgeText}>
                    {myRole === 'admin' ? t('profile.roleAdmin') : t('profile.roleSuperuser')}
                  </ThemedText>
                </View>
              )}
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.emailText}>
              {session.user.email}
            </ThemedText>
            <Pressable onPress={handleSignOut}>
              <ThemedText style={styles.logOutText}>{t('profile.logOut')}</ThemedText>
            </Pressable>
          </View>
          <Pressable
            style={[styles.notificationBellButton, { borderColor: theme.text }]}
            onPress={() => router.push('/notifications')}
            hitSlop={8}>
            <Ionicons name="notifications-outline" size={24} color={theme.text} />
            {unreadCount > 0 && <View style={styles.notificationDot} />}
          </Pressable>
        </View>

        {myBan && (
          <View style={styles.banNotice}>
            <View style={styles.banNoticeHeader}>
              <Ionicons name="alert-circle" size={18} color="#ffffff" />
              <ThemedText type="smallBold" style={styles.banNoticeTitle}>
                {t('profile.banTitle')}
              </ThemedText>
            </View>
            <ThemedText type="small" style={styles.banNoticeText}>
              {myBan.expiresAt
                ? t('profile.banUntil', { date: new Date(myBan.expiresAt).toLocaleDateString() })
                : t('profile.banIndefinite')}
            </ThemedText>
            <ThemedText type="small" style={styles.banNoticeText}>
              {t('profile.banReason', { reason: myBan.reason })}
            </ThemedText>
            <Pressable onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Ban appeal`)}>
              <ThemedText type="smallBold" style={styles.banAppealLink}>
                {t('profile.banAppeal')}
              </ThemedText>
            </Pressable>
          </View>
        )}

        {myWarnings.map((warning) => (
          <View key={warning.id} style={styles.warningNotice}>
            <View style={styles.banNoticeHeader}>
              <Ionicons name="warning" size={18} color="#1A1400" />
              <ThemedText type="smallBold" style={styles.warningNoticeText}>
                {t('profile.warningTitle')}
              </ThemedText>
            </View>
            <ThemedText type="small" style={styles.warningNoticeText}>
              {warning.reason}
            </ThemedText>
            <Pressable
              onPress={() => {
                setMyWarnings((current) => current.filter((w) => w.id !== warning.id));
                acknowledgeWarning(supabase, warning.id).catch((err) => {
                  // Swallowing this made the warning silently reappear on the
                  // next load with no explanation. Put it back straight away so
                  // what's on screen matches what was actually saved.
                  console.error('Could not acknowledge warning', err);
                  setMyWarnings((current) =>
                    current.some((w) => w.id === warning.id) ? current : [...current, warning]
                  );
                });
              }}>
              <ThemedText type="smallBold" style={styles.warningDismiss}>
                {t('profile.warningDismiss')}
              </ThemedText>
            </Pressable>
          </View>
        ))}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statsScroll}
          contentContainerStyle={styles.statsRow}
        >
          {statTiles(stats).map((stat) => {
            const clickable =
              stat.id === 'reviews' || stat.id === 'added' || Boolean(STAT_SECTIONS[stat.id]);
            return (
              <Pressable
                key={stat.id}
                style={[styles.statTile, { width: statTileWidth, borderColor: theme.fieldBorder }]}
                disabled={!clickable}
                onPress={() => handleStatPress(stat.id)}
              >
                <ThemedText style={[styles.statValue, { color: stat.color }]}>{stat.value}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel} numberOfLines={1}>
                  {t(STAT_LABELS[stat.id])}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        {/*
          * A line rather than a sixth tile: every tile opens the list behind
          * it, and this number deliberately does not match any list. It counts
          * what you have contributed over time, including the activities that
          * have since ended and the reviews you have deleted — which is the
          * one figure the live counts cannot keep.
          */}
        {stats.contributions > 0 && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.contributionsLine}>
            {t('profile.contributionsTotal', { count: stats.contributions })}
          </ThemedText>
        )}

        <View style={styles.menu}>
          {PRIMARY_MENU_ITEMS.map((item) => (
            <MenuRow
              key={item}
              item={item}
              badgeCount={item === 'friends' ? pendingFriendRequests : undefined}
              onPress={() => handleMenuPress(item)}
            />
          ))}
        </View>

        <View style={[styles.menu, styles.menuGroupGap]}>
          {SECONDARY_MENU_ITEMS.map((item) => (
            <MenuRow key={item} item={item} onPress={() => handleMenuPress(item)} />
          ))}
        </View>

        <View style={[styles.menu, styles.menuGroupGap]}>
          {ACCOUNT_MENU_ITEMS.map((item) => (
            <MenuRow key={item} item={item} onPress={() => handleMenuPress(item)} />
          ))}
        </View>

        {/* Reports, People & bans, Moderation log, Crash reports and Feedback
            used to each get their own row here — five rows that only a
            moderator or admin ever saw, on a screen already carrying the
            stat tiles above. One row into the Admin hub screen instead;
            the open-reports count still surfaces here so it's visible
            without a tap. */}
        {isModerator && (
          <View style={[styles.menu, styles.menuGroupGap]}>
            <MenuRow item="admin" badgeCount={openReportsCount} onPress={() => handleMenuPress('admin')} />
          </View>
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
  profileRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
  },
  notificationBellButton: {
    width: 48,
    height: 48,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    // Pushed to the far edge and pinned to the top of the row, so it sits level
    // with the top of the avatar rather than beside the username.
    marginLeft: 'auto',
    alignSelf: 'flex-start',
  },
  notificationDot: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#E05252',
  },
  infoColumn: {
    flexShrink: 1,
    gap: 2,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  usernameText: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E8A93B',
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.five,
  },
  adminBadge: {
    backgroundColor: '#4CD37A',
  },
  roleBadgeText: {
    color: '#1A1400',
    fontWeight: '700',
    fontSize: 11,
  },
  logOutText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    textDecorationLine: 'underline',
    marginTop: Spacing.two,
  },
  emailText: {
    fontSize: 14,
    lineHeight: 18,
  },
  loggedOutPrompt: {
    gap: Spacing.three,
    alignItems: 'center',
    paddingVertical: Spacing.six,
  },
  centerText: {
    textAlign: 'center',
  },
  primaryButton: {
    height: 48,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14747A',
  },
  primaryButtonText: {
    color: '#ffffff',
  },
  statsScroll: {
    flexGrow: 0,
  },
  statsRow: {
    flexDirection: 'row',
    gap: STAT_TILE_GAP,
    paddingBottom: Spacing.four,
  },
  contributionsLine: {
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  statTile: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.half,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Spacing.half,
  },
  statValue: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
  },
  statLabel: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 13,
  },
  menu: {
    width: MENU_ROW_WIDTH,
    gap: Spacing.one,
  },
  menuGroupGap: {
    marginTop: Spacing.three * 2,
  },
  loggedOutMenu: {
    alignSelf: 'center',
  },
  banNotice: {
    backgroundColor: '#7A2020',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.half,
    marginBottom: Spacing.three,
  },
  banNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  banNoticeTitle: {
    color: '#ffffff',
  },
  banNoticeText: {
    color: 'rgba(255,255,255,0.9)',
  },
  banAppealLink: {
    color: '#ffffff',
    textDecorationLine: 'underline',
    marginTop: Spacing.one,
  },
  warningNotice: {
    backgroundColor: '#E8A93B',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.half,
    marginBottom: Spacing.three,
  },
  warningNoticeText: {
    color: '#1A1400',
  },
  warningDismiss: {
    color: '#1A1400',
    textDecorationLine: 'underline',
    marginTop: Spacing.one,
  },
});
