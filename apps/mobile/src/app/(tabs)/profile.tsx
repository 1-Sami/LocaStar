import { fetchProfile, fetchProfileStats, type ProfileStats } from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

const EMPTY_STATS: ProfileStats = { favorites: 0, bucketList: 0, shared: 0, reviews: 0, added: 0 };

const STAT_TILE_WIDTH = 91;
const STAT_TILE_GAP = 10;
const MENU_ROW_WIDTH = STAT_TILE_WIDTH * 3 + STAT_TILE_GAP * 2;

function statTiles(stats: ProfileStats) {
  return [
    { label: 'Favorites', value: stats.favorites, color: '#E8A93B' },
    { label: 'Bucket list', value: stats.bucketList, color: '#4C8FE8' },
    { label: 'Shared', value: stats.shared, color: '#B0B4BA' },
    { label: 'Reviews', value: stats.reviews, color: '#4CD37A' },
    { label: 'Added', value: stats.added, color: '#C34CE8' },
  ];
}

const STAT_SECTIONS: Record<string, string> = {
  Favorites: 'favorites',
  'Bucket list': 'bucketList',
  Shared: 'shared',
};

const baseMenuItems = ['My reviews', 'My lists', 'Add location', 'Add activity', 'Settings', 'About'];

const MENU_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  'My reviews': { icon: 'create-outline', color: '#4CD37A' },
  'My lists': { icon: 'bookmark-outline', color: '#4C8FE8' },
  'Add location': { icon: 'add-circle-outline', color: '#C34CE8' },
  'Add activity': { icon: 'time-outline', color: '#E8A93B' },
  Settings: { icon: 'settings-outline', color: '#B0B4BA' },
  About: { icon: 'information-circle-outline', color: '#14747A' },
  'Reports (admin)': { icon: 'flag-outline', color: '#E05252' },
};

function BrandFooter() {
  return (
    <View style={styles.footer}>
      <ThemedText type="subtitle" themeColor="textSecondary" style={styles.brand}>
        LOCASTAR
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        EXPLORE. MAP. SHARE.
      </ThemedText>
    </View>
  );
}

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<ProfileStats>(EMPTY_STATS);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

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
      fetchProfile(supabase, session.user.id)
        .then((profile) => {
          if (!cancelled) {
            setAvatarUrl(profile.avatar_url);
            setIsAdmin(profile.role === 'admin');
          }
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [session])
  );

  const menuItems = isAdmin ? [...baseMenuItems, 'Reports (admin)'] : baseMenuItems;

  const handleMenuPress = (item: string) => {
    if (item === 'My reviews') router.push('/my-reviews');
    if (item === 'My lists') router.push('/lists' as never);
    if (item === 'Add location') router.push({ pathname: '/add-location', params: { kind: 'place' } });
    if (item === 'Add activity') router.push({ pathname: '/add-location', params: { kind: 'activity' } });
    if (item === 'Settings') router.push('/settings' as never);
    if (item === 'About') router.push('/about');
    if (item === 'Reports (admin)') router.push('/admin-reports');
  };

  const handleStatPress = (label: string) => {
    if (label === 'Reviews') {
      router.push('/my-reviews');
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
          <BrandFooter />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="subtitle" style={styles.header}>
          Profile
        </ThemedText>

        <View style={styles.profileRow}>
          <Pressable onPress={() => router.push('/settings/profile-picture' as never)}>
            <Image
              source={{ uri: avatarUrl ?? `https://picsum.photos/seed/${session.user.id}/200/200` }}
              style={styles.avatar}
            />
          </Pressable>
          <View>
            <Pressable onPress={signOut}>
              <ThemedText type="link" style={styles.logOutText}>
                Log out
              </ThemedText>
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary" style={styles.emailText}>
              {session.user.email}
            </ThemedText>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statsScroll}
          contentContainerStyle={styles.statsRow}
        >
          {statTiles(stats).map((stat) => {
            const clickable = stat.label === 'Reviews' || Boolean(STAT_SECTIONS[stat.label]);
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
          {menuItems.map((item) => {
            const iconConfig = MENU_ICONS[item];
            return (
              <Pressable key={item} onPress={() => handleMenuPress(item)}>
                <ThemedView type="backgroundElement" style={styles.menuItem}>
                  <View style={styles.menuItemLeft}>
                    {iconConfig && (
                      <View style={[styles.menuIcon, { backgroundColor: `${iconConfig.color}33` }]}>
                        <Ionicons name={iconConfig.icon} size={17} color={iconConfig.color} />
                      </View>
                    )}
                    <ThemedText type="default" style={styles.menuItemText}>
                      {item}
                    </ThemedText>
                  </View>
                  <ThemedText themeColor="textSecondary" style={styles.menuChevron}>
                    ›
                  </ThemedText>
                </ThemedView>
              </Pressable>
            );
          })}
        </View>

        <BrandFooter />
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
    gap: 19,
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  avatar: {
    width: 106,
    height: 106,
    borderRadius: 53,
  },
  logOutText: {
    fontSize: 17,
  },
  emailText: {
    fontSize: 17,
    lineHeight: 24,
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
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.half,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Spacing.half,
  },
  statValue: {
    fontSize: 23,
    lineHeight: 26,
    fontWeight: '700',
  },
  statLabel: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 18,
  },
  menu: {
    width: MENU_ROW_WIDTH,
    gap: Spacing.one,
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
  footer: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingVertical: Spacing.six,
    opacity: 0.5,
  },
  brand: {
    fontSize: 22,
  },
});
