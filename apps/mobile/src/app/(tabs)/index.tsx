import {
  fetchNearbyLocations,
  fetchProfileStats,
  fetchPublicLists,
  setListLiked,
  type NearbyLocation,
  type ProfileStats,
  type PublicList,
} from '@locastar/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CompactLocationCard } from '@/components/compact-location-card';
import { ListCard } from '@/components/list-card';
import { LocaStarLogo } from '@/components/locastar-logo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSaves } from '@/hooks/use-saves';
import { useUserLocation } from '@/hooks/use-user-location';
import { useAuth } from '@/lib/auth-context';
import { nearbyLocationToCard } from '@/lib/location-adapters';
import { supabase } from '@/lib/supabase';

// Effectively "no radius limit", matching Search — the current dataset is
// sparse enough that a realistic nearby-only radius would leave several
// Home sections empty.
const HOME_RADIUS_M = 20_000_000;

// Boosted/paid placement is built but stays hidden until there are enough users
// to sell placement to. Flip to true to bring the section back.
const SHOW_BOOSTED_SECTION = false;

// The header text block is sized to match this exactly (33 + 15 line-heights).
const HEADER_LOGO_SIZE = 48;

const EMPTY_STATS: ProfileStats = {
  favorites: 0,
  bucketList: 0,
  shared: 0,
  reviews: 0,
  added: 0,
  lists: 0,
  activities: 0,
};

const STAT_SECTIONS: Record<string, string> = {
  Favorites: 'favorites',
  'Saved for later': 'bucketList',
  Shared: 'shared',
};

function statTiles(stats: ProfileStats) {
  return [
    { label: 'Favorites', value: stats.favorites, color: '#E8A93B' },
    { label: 'Saved for later', value: stats.bucketList, color: '#4C8FE8' },
    { label: 'Shared', value: stats.shared, color: '#B0B4BA' },
    { label: 'Reviews', value: stats.reviews, color: '#4CD37A' },
    { label: 'Added', value: stats.added, color: '#C34CE8' },
    { label: 'My lists', value: stats.lists, color: '#2BA3A3' },
    { label: 'Activities', value: stats.activities, color: '#F2545B' },
  ];
}

const CTA_TILES = [
  { line1: 'Save', line2: 'Favorites', color: '#2F7BB0' },
  { line1: 'Leave a', line2: 'review', color: '#3B4A1E' },
  { line1: 'Plan a', line2: 'trip', color: '#E2791F' },
  { line1: 'Create a private', line2: 'activity', color: '#A64BD6' },
  { line1: 'Share with', line2: 'friends', color: '#7C2E3A' },
  { line1: 'Add a', line2: 'location', color: '#1AA15C' },
  { line1: 'Create a', line2: 'list', color: '#55738F' },
  { line1: 'AND', line2: 'MORE', color: '#2B2E6B' },
];

function HomeSection<T>({
  title,
  onShowMore,
  items,
  keyExtractor,
  renderItem,
  emptyText,
  cardWidth = 280,
}: {
  title: string;
  onShowMore: () => void;
  items: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  emptyText: string;
  cardWidth?: number;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <ThemedText type="smallBold" style={styles.sectionTitle}>
          {title}
        </ThemedText>
        <Pressable onPress={onShowMore} hitSlop={8}>
          <ThemedText type="small" themeColor="textSecondary">
            Show more
          </ThemedText>
        </Pressable>
      </View>
      {items.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.sectionEmptyText}>
          {emptyText}
        </ThemedText>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionScrollContent}>
          {items.map((item) => (
            <View key={keyExtractor(item)} style={{ width: cardWidth }}>
              {renderItem(item)}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { coords } = useUserLocation();
  const { bucketListIds, toggleBucketList } = useSaves();

  const [nearby, setNearby] = useState<NearbyLocation[]>([]);
  const [publicLists, setPublicLists] = useState<PublicList[]>([]);
  const [stats, setStats] = useState<ProfileStats>(EMPTY_STATS);

  const reload = useCallback(() => {
    let cancelled = false;

    fetchPublicLists(supabase, session?.user.id ?? null)
      .then((rows) => {
        if (!cancelled) setPublicLists(rows);
      })
      .catch(() => {
        if (!cancelled) setPublicLists([]);
      });

    if (coords) {
      fetchNearbyLocations(supabase, {
        lat: coords.latitude,
        lng: coords.longitude,
        radiusM: HOME_RADIUS_M,
        sort: 'distance',
        // Home slices five sections out of this one query, so it needs more
        // than the RPC's default of 100. Worth knowing what the cap changes:
        // "Most liked" becomes most-liked *among the nearest 200* rather than
        // in the whole country. With a national dataset that is arguably the
        // better answer, but it is a change, not a no-op.
        maxResults: 200,
      })
        .then((rows) => {
          if (!cancelled) setNearby(rows);
        })
        .catch(() => {
          if (!cancelled) setNearby([]);
        });
    }

    if (session) {
      fetchProfileStats(supabase, session.user.id)
        .then((result) => {
          if (!cancelled) setStats(result);
        })
        .catch(() => {
          if (!cancelled) setStats(EMPTY_STATS);
        });
    } else {
      setStats(EMPTY_STATS);
    }

    return () => {
      cancelled = true;
    };
  }, [coords, session]);

  useFocusEffect(
    useCallback(() => {
      return reload();
    }, [reload])
  );

  const handleOpenLocation = (id: string) => router.push({ pathname: '/location/[id]', params: { id } });

  const handleToggleListLike = (list: PublicList) => {
    if (!session) {
      router.push('/sign-in');
      return;
    }
    const nextLiked = !list.likedByMe;
    setPublicLists((current) =>
      current.map((item) =>
        item.id === list.id
          ? { ...item, likedByMe: nextLiked, likeCount: item.likeCount + (nextLiked ? 1 : -1) }
          : item
      )
    );
    setListLiked(supabase, list.id, session.user.id, nextLiked).catch(() => reload());
  };

  const handleStatPress = (label: string) => {
    if (label === 'Reviews') {
      router.push('/my-reviews');
      return;
    }
    if (label === 'Added' || label === 'Activities') {
      router.push('/my-locations' as never);
      return;
    }
    if (label === 'My lists') {
      router.push('/lists' as never);
      return;
    }
    const section = STAT_SECTIONS[label];
    if (section) router.push({ pathname: '/favorites', params: { section } });
  };

  const activities = nearby.filter((l) => l.kind === 'activity').slice(0, 10);
  const boosted = nearby.filter((l) => l.is_boosted).slice(0, 10);
  const mostLiked = [...nearby]
    .sort((a, b) => b.avg_rating - a.avg_rating || b.review_count - a.review_count)
    .slice(0, 10);
  const summerActivities = nearby.filter((l) => l.available_summer).slice(0, 10);
  const winterActivities = nearby.filter((l) => l.available_winter).slice(0, 10);

  const renderLocationCard = (item: NearbyLocation) => (
    <CompactLocationCard
      location={nearbyLocationToCard(item)}
      isBucketListed={bucketListIds.has(item.id)}
      onToggleBucketList={() => toggleBucketList(item.id)}
      onPress={() => handleOpenLocation(item.id)}
    />
  );

  const renderBoostedCard = (item: NearbyLocation) => (
    <CompactLocationCard
      location={nearbyLocationToCard(item)}
      isBucketListed={bucketListIds.has(item.id)}
      onToggleBucketList={() => toggleBucketList(item.id)}
      onPress={() => handleOpenLocation(item.id)}
      showBoostedBadge
    />
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <LocaStarLogo size={HEADER_LOGO_SIZE} />
            <View style={styles.headerText}>
              <ThemedText style={styles.logo}>LOCASTAR</ThemedText>
              <ThemedText themeColor="accent" style={styles.tagline}>
                EXPLORE. MAP. SHARE.
              </ThemedText>
            </View>
          </View>

          <HomeSection
            title="Activitys"
            onShowMore={() => router.push('/search')}
            items={activities}
            keyExtractor={(item) => item.id}
            cardWidth={108}
            renderItem={renderLocationCard}
            emptyText="No activities nearby yet."
          />

          {SHOW_BOOSTED_SECTION && (
            <HomeSection
              title="Boosted / Paid placement"
              onShowMore={() => router.push('/search')}
              items={boosted}
              keyExtractor={(item) => item.id}
              cardWidth={108}
              renderItem={renderBoostedCard}
              emptyText="Nothing boosted yet."
            />
          )}

          <HomeSection
            title="Community shared lists"
            onShowMore={() => router.push('/community')}
            items={publicLists}
            keyExtractor={(item) => item.id}
            cardWidth={170}
            renderItem={(item) => (
              <ListCard
                list={item}
                ownerUsername={item.ownerUsername ?? item.ownerDisplayName ?? 'someone'}
                onPress={() =>
                  router.push({
                    pathname: '/lists/[id]',
                    params: { id: item.id, name: item.name, isPublic: '1', shared: '1' },
                  })
                }
                onToggleLike={() => handleToggleListLike(item)}
              />
            )}
            emptyText="No public lists yet."
          />

          <View style={styles.statsSection}>
            {session ? (
              <>
                <ThemedText type="smallBold" style={styles.statsTitle}>
                  Your activity at a glance
                </ThemedText>
                <View style={styles.tileGrid}>
                  {statTiles(stats).map((tile) => (
                    <Pressable key={tile.label} style={styles.statTile} onPress={() => handleStatPress(tile.label)}>
                      <ThemedText style={[styles.statValue, { color: tile.color }]}>{tile.value}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel} numberOfLines={1}>
                        {tile.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <>
                <ThemedText type="smallBold" style={styles.statsTitle}>
                  Create an account and do more:
                </ThemedText>
                <View style={styles.ctaGrid}>
                  {[CTA_TILES.slice(0, 4), CTA_TILES.slice(4, 8)].map((row, rowIndex) => (
                    <View key={rowIndex} style={styles.ctaRow}>
                      {row.map((tile) => (
                        <Pressable
                          key={`${tile.line1} ${tile.line2}`}
                          style={[styles.ctaTile, { backgroundColor: tile.color }]}
                          onPress={() => router.push('/sign-in')}>
                          <ThemedText type="smallBold" style={styles.ctaTileText}>
                            {tile.line1}
                          </ThemedText>
                          <ThemedText type="smallBold" style={styles.ctaTileText}>
                            {tile.line2}
                          </ThemedText>
                        </Pressable>
                      ))}
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>

          <HomeSection
            title="Most liked places"
            onShowMore={() => router.push({ pathname: '/search', params: { sort: 'rating' } })}
            items={mostLiked}
            keyExtractor={(item) => item.id}
            cardWidth={108}
            renderItem={renderLocationCard}
            emptyText="Nothing to show yet."
          />

          <HomeSection
            title="List of summer activities"
            onShowMore={() => router.push({ pathname: '/search', params: { season: 'summer' } })}
            items={summerActivities}
            keyExtractor={(item) => item.id}
            cardWidth={108}
            renderItem={renderLocationCard}
            emptyText="No summer activities added yet."
          />

          <HomeSection
            title="List of winter activities"
            onShowMore={() => router.push({ pathname: '/search', params: { season: 'winter' } })}
            items={winterActivities}
            keyExtractor={(item) => item.id}
            cardWidth={108}
            renderItem={renderLocationCard}
            emptyText="No winter activities added yet."
          />
        </ScrollView>
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
  },
  content: {
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.five,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.25)',
  },
  // The two lines' line-heights add up to exactly the logo's height so the
  // text block and the mark are the same height.
  headerText: {
    height: HEADER_LOGO_SIZE,
    justifyContent: 'center',
  },
  logo: {
    fontFamily: Fonts.serif,
    fontSize: 27,
    lineHeight: 33,
    letterSpacing: 1,
    fontWeight: '600',
  },
  tagline: {
    fontFamily: Fonts.serif,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.5,
  },
  section: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 15,
  },
  sectionScrollContent: {
    gap: Spacing.two,
    paddingRight: Spacing.three,
  },
  sectionEmptyText: {
    paddingVertical: Spacing.two,
  },
  statsSection: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  statsTitle: {
    fontSize: 15,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  statTile: {
    width: 78,
    height: 62,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128,128,128,0.4)',
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
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
  ctaGrid: {
    gap: Spacing.two,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  ctaTile: {
    flex: 1,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.two,
  },
  ctaTileText: {
    color: '#ffffff',
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 13,
  },
});
