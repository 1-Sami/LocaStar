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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SUPPORT_EMAIL } from '@/constants/support';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
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
};

const STAT_TILE_WIDTH = 59;
const STAT_TILE_GAP = 10;
const MENU_ROW_WIDTH = (91 * 3 + STAT_TILE_GAP * 2) * 0.8;

function statTiles(stats: ProfileStats) {
  return [
    { label: 'Favorites', value: stats.favorites, color: '#E8A93B' },
    { label: 'Saved for later', value: stats.bucketList, color: '#4C8FE8' },
    { label: 'Shared', value: stats.shared, color: '#B0B4BA' },
    { label: 'Reviews', value: stats.reviews, color: '#4CD37A' },
    { label: 'Added', value: stats.added, color: '#C34CE8' },
  ];
}

const STAT_SECTIONS: Record<string, string> = {
  Favorites: 'favorites',
  'Saved for later': 'bucketList',
  Shared: 'shared',
};

const PRIMARY_MENU_ITEMS = ['My reviews', 'My lists', 'Friends', 'Add location', 'Add activity'];
const SECONDARY_MENU_ITEMS = ['Settings', 'About'];

const MENU_ICONS: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; family?: 'ionicons'; color: string } | {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    family: 'material';
    color: string;
  }
> = {
  'My reviews': { icon: 'create-outline', color: '#4CD37A' },
  'My lists': { icon: 'folder-marker-outline', family: 'material', color: '#4C8FE8' },
  Friends: { icon: 'people-outline', color: '#F5738A' },
  'Add location': { icon: 'add-circle-outline', color: '#C34CE8' },
  'Add activity': { icon: 'time-outline', color: '#E8A93B' },
  Settings: { icon: 'settings-outline', color: '#B0B4BA' },
  About: { icon: 'information-circle-outline', color: '#14747A' },
  'Reports': { icon: 'flag-outline', color: '#E05252' },
  'People & bans': { icon: 'shield-checkmark-outline', color: '#E8A93B' },
  'Moderation log': { icon: 'document-text-outline', color: '#4C8FE8' },
};

function MenuRow({
  item,
  badgeCount,
  onPress,
}: {
  item: string;
  badgeCount?: number;
  onPress: () => void;
}) {
  const iconConfig = MENU_ICONS[item];
  return (
    <Pressable onPress={onPress}>
      <ThemedView type="backgroundElement" style={styles.menuItem}>
        <View style={styles.menuItemLeft}>
          {iconConfig && (
            <View style={[styles.menuIcon, { backgroundColor: `${iconConfig.color}33` }]}>
              {iconConfig.family === 'material' ? (
                <MaterialCommunityIcons name={iconConfig.icon} size={17} color={iconConfig.color} />
              ) : (
                <Ionicons name={iconConfig.icon} size={17} color={iconConfig.color} />
              )}
            </View>
          )}
          <ThemedText type="default" style={styles.menuItemText}>
            {item}
          </ThemedText>
          {badgeCount !== undefined && badgeCount > 0 && (
            <View style={styles.reportsBadge}>
              <ThemedText type="small" style={styles.reportsBadgeText}>
                {badgeCount}
              </ThemedText>
            </View>
          )}
        </View>
        <ThemedText themeColor="textSecondary" style={styles.menuChevron}>
          ›
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const { unreadCount } = useNotificationsBadge();
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
        .catch(() => {
          if (!cancelled) setStats(EMPTY_STATS);
        });
      fetchMyActiveBan(supabase, session.user.id)
        .then((ban) => {
          if (!cancelled) setMyBan(ban);
        })
        .catch(() => {});
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
    const confirmed = await confirmAsync('Log out?', 'You’ll need to log in again to access your account.', 'Log out');
    if (confirmed) signOut();
  };

  const secondaryMenuItems = isModerator
    ? [...SECONDARY_MENU_ITEMS, 'Reports', 'People & bans', 'Moderation log']
    : SECONDARY_MENU_ITEMS;

  const handleMenuPress = (item: string) => {
    if (item === 'My reviews') router.push('/my-reviews');
    if (item === 'My lists') router.push('/lists' as never);
    if (item === 'Friends') router.push('/friends' as never);
    if (item === 'Add location') router.push({ pathname: '/add-location', params: { kind: 'place' } });
    if (item === 'Add activity') router.push({ pathname: '/add-location', params: { kind: 'activity' } });
    if (item === 'Settings') router.push('/settings' as never);
    if (item === 'About') router.push('/about');
    if (item === 'Reports') router.push('/admin-reports');
    if (item === 'People & bans') router.push('/admin-users' as never);
    if (item === 'Moderation log') router.push('/admin-audit' as never);
  };

  const handleStatPress = (label: string) => {
    if (label === 'Reviews') {
      router.push('/my-reviews');
      return;
    }
    if (label === 'Added') {
      router.push('/my-locations' as never);
      return;
    }
    const section = STAT_SECTIONS[label];
    if (section) {
      router.push({ pathname: '/favorites', params: { section } });
    }
  };

  if (!session) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <ThemedText type="subtitle" style={styles.header}>
            Profile
          </ThemedText>
          <View style={styles.loggedOutPrompt}>
            <ThemedText type="default" themeColor="textSecondary" style={styles.centerText}>
              Log in to save favorites, write reviews, and add your own locations.
            </ThemedText>
            <Pressable style={styles.primaryButton} onPress={() => router.push('/sign-in')}>
              <ThemedText type="smallBold" style={styles.primaryButtonText}>
                Log in
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => router.push('/sign-up')}>
              <ThemedText type="linkPrimary">Create an account</ThemedText>
            </Pressable>
          </View>
          {/* Available logged out too — it explains what the app is for. */}
          <View style={[styles.menu, styles.loggedOutMenu]}>
            <MenuRow item="About" onPress={() => router.push('/about')} />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.bellRow}>
          <Pressable
            style={[styles.notificationBellButton, { borderColor: theme.text }]}
            onPress={() => router.push('/notifications')}
            hitSlop={8}>
            <Ionicons name="notifications-outline" size={24} color={theme.text} />
            {unreadCount > 0 && <View style={styles.notificationDot} />}
          </Pressable>
        </View>

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
                    {myRole === 'admin' ? 'Admin' : 'Superuser'}
                  </ThemedText>
                </View>
              )}
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.emailText}>
              {session.user.email}
            </ThemedText>
            <Pressable onPress={handleSignOut}>
              <ThemedText style={styles.logOutText}>LOG OUT</ThemedText>
            </Pressable>
          </View>
        </View>

        {myBan && (
          <View style={styles.banNotice}>
            <View style={styles.banNoticeHeader}>
              <Ionicons name="alert-circle" size={18} color="#ffffff" />
              <ThemedText type="smallBold" style={styles.banNoticeTitle}>
                Your account is restricted
              </ThemedText>
            </View>
            <ThemedText type="small" style={styles.banNoticeText}>
              {myBan.expiresAt
                ? `Until ${new Date(myBan.expiresAt).toLocaleDateString()}, you can browse but not post reviews, add locations, or share.`
                : 'You can browse but not post reviews, add locations, or share.'}
            </ThemedText>
            <ThemedText type="small" style={styles.banNoticeText}>
              Reason: {myBan.reason}
            </ThemedText>
            <Pressable onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Ban appeal`)}>
              <ThemedText type="smallBold" style={styles.banAppealLink}>
                Appeal this decision
              </ThemedText>
            </Pressable>
          </View>
        )}

        {myWarnings.map((warning) => (
          <View key={warning.id} style={styles.warningNotice}>
            <View style={styles.banNoticeHeader}>
              <Ionicons name="warning" size={18} color="#1A1400" />
              <ThemedText type="smallBold" style={styles.warningNoticeText}>
                Warning from a moderator
              </ThemedText>
            </View>
            <ThemedText type="small" style={styles.warningNoticeText}>
              {warning.reason}
            </ThemedText>
            <Pressable
              onPress={() => {
                setMyWarnings((current) => current.filter((w) => w.id !== warning.id));
                acknowledgeWarning(supabase, warning.id).catch(() => {});
              }}>
              <ThemedText type="smallBold" style={styles.warningDismiss}>
                Got it
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
              stat.label === 'Reviews' || stat.label === 'Added' || Boolean(STAT_SECTIONS[stat.label]);
            return (
              <Pressable
                key={stat.label}
                style={styles.statTile}
                disabled={!clickable}
                onPress={() => handleStatPress(stat.label)}
              >
                <ThemedText style={[styles.statValue, { color: stat.color }]}>{stat.value}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel} numberOfLines={1}>
                  {stat.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.menu}>
          {PRIMARY_MENU_ITEMS.map((item) => (
            <MenuRow
              key={item}
              item={item}
              badgeCount={item === 'Friends' ? pendingFriendRequests : undefined}
              onPress={() => handleMenuPress(item)}
            />
          ))}
        </View>

        <View style={[styles.menu, styles.menuGroupGap]}>
          {secondaryMenuItems.map((item) => (
            <MenuRow
              key={item}
              item={item}
              badgeCount={item === 'Reports' ? openReportsCount : undefined}
              onPress={() => handleMenuPress(item)}
            />
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
  // Sits above the profile row so the avatar/username stack under the bell.
  bellRow: {
    alignItems: 'flex-end',
    paddingTop: Spacing.four,
  },
  profileRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  notificationBellButton: {
    width: 48,
    height: 48,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
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
  statTile: {
    width: STAT_TILE_WIDTH,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128,128,128,0.4)',
    borderRadius: Spacing.two,
    paddingVertical: 5,
    paddingHorizontal: Spacing.half,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Spacing.half,
  },
  statValue: {
    fontSize: 15,
    lineHeight: 17,
    fontWeight: '700',
  },
  statLabel: {
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 12,
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
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: Spacing.two,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuItemText: {
    fontSize: 19,
    lineHeight: 26,
  },
  reportsBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: '#E05252',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportsBadgeText: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  menuChevron: {
    fontSize: 19,
  },
  menuIcon: {
    width: 29,
    height: 29,
    borderRadius: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
