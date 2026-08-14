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
import { useTranslation } from 'react-i18next';
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

/*
 * How far the near-you sections reach.
 *
 * A real limit, unlike HOME_RADIUS_M above, which is 20 000 km and therefore no
 * limit at all.
 *
 * Activities are exempt and keep the unbounded radius: people will drive an
 * hour and a half to a festival and not five minutes to a boule court.
 */
const HOME_NEARBY_RADIUS_M = 30_000;

/*
 * Rows per carousel — and the reason every section now asks its own question.
 *
 * Home used to slice most of its sections out of one query for the nearest 200
 * locations. That quietly decided what the sections could contain: with 993
 * rows in the table the nearest 200 to Norsborg stop at 18.3 km, so
 * Väsjöbacken at 25.1 km never reached the winter carousel — it was cut before
 * anything looked at whether it was open in winter. Six locations in the
 * country are marked for winter, and they were competing with 993 rows for 200
 * slots. Every boule court added made it worse.
 *
 * A bigger shared cap only postpones that. Asking the database a separate,
 * filtered question per section removes the competition entirely, and each
 * answer is small because the RPC sorts and filters before it caps — fifteen
 * rows means the fifteen the section is actually about.
 *
 * It is also less work, not more: four queries of fifteen replace two of two
 * hundred. Past fifteen there is a "Show more" that carries the same filter
 * into Search, which is the screen built for going through a long list.
 */
const HOME_SECTION_LIMIT = 15;

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

/*
 * Stat tiles carry an id, not their label. See the note in profile.tsx: the
 * label used to be the identifier, so translating it would have left every
 * tile's tap doing nothing.
 *
 * Home shows seven tiles to Profile's five; the five they share reuse the same
 * profile.stat* keys rather than being translated twice.
 */
type StatId = 'favorites' | 'bucketList' | 'shared' | 'reviews' | 'added' | 'lists' | 'activities';

function statTiles(stats: ProfileStats): { id: StatId; value: number; color: string }[] {
  return [
    { id: 'favorites', value: stats.favorites, color: '#E8A93B' },
    { id: 'bucketList', value: stats.bucketList, color: '#4C8FE8' },
    { id: 'shared', value: stats.shared, color: '#B0B4BA' },
    { id: 'reviews', value: stats.reviews, color: '#4CD37A' },
    { id: 'added', value: stats.added, color: '#C34CE8' },
    { id: 'lists', value: stats.lists, color: '#2BA3A3' },
    { id: 'activities', value: stats.activities, color: '#F2545B' },
  ];
}

const STAT_LABELS: Record<StatId, string> = {
  favorites: 'profile.statFavorites',
  bucketList: 'profile.statBucketList',
  shared: 'profile.statShared',
  reviews: 'profile.statReviews',
  added: 'profile.statAdded',
  lists: 'profile.statLists',
  activities: 'profile.statActivities',
};

/** The three that open the Saved screen at a particular section. */
const STAT_SECTIONS: Partial<Record<StatId, string>> = {
  favorites: 'favorites',
  bucketList: 'bucketList',
  shared: 'shared',
};

const CTA_TILES = [
  { id: 'favorites', color: '#2F7BB0' },
  { id: 'review', color: '#3B4A1E' },
  { id: 'trip', color: '#E2791F' },
  { id: 'activity', color: '#A64BD6' },
  { id: 'share', color: '#7C2E3A' },
  { id: 'location', color: '#1AA15C' },
  { id: 'list', color: '#55738F' },
  { id: 'more', color: '#2B2E6B' },
] as const;

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
  const { t } = useTranslation();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <ThemedText type="smallBold" style={styles.sectionTitle}>
          {title}
        </ThemedText>
        <Pressable onPress={onShowMore} hitSlop={8}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('home.showMore')}
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
  const { t } = useTranslation();
  const { coords } = useUserLocation();
  const { bucketListIds, toggleBucketList } = useSaves();

  const [nearby, setNearby] = useState<NearbyLocation[]>([]);
  const [nearbyActivities, setNearbyActivities] = useState<NearbyLocation[]>([]);
  const [nearbyMostLiked, setNearbyMostLiked] = useState<NearbyLocation[]>([]);
  const [nearbySummer, setNearbySummer] = useState<NearbyLocation[]>([]);
  const [nearbyWinter, setNearbyWinter] = useState<NearbyLocation[]>([]);
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
      /*
       * Only the boosted carousel still needs the broad proximity query, and it
       * is switched off — so while it is off, Home does not run it at all. It
       * cannot be answered by a filtered query like the others: is_boosted is
       * not something the RPC filters on.
       */
      if (SHOW_BOOSTED_SECTION) {
        fetchNearbyLocations(supabase, {
          lat: coords.latitude,
          lng: coords.longitude,
          radiusM: HOME_RADIUS_M,
          sort: 'distance',
          maxResults: 200,
        })
          .then((rows) => {
            if (!cancelled) setNearby(rows);
          })
          .catch(() => {
            if (!cancelled) setNearby([]);
          });
      }

      /*
       * Activities: no distance limit, on purpose.
       *
       * They were sliced out of a proximity query once, and it ate them — a
       * festival in Eskilstuna at 88 km was gone before the kind filter ever
       * ran. Distance is the wrong axis here, so this asks for the fifteen
       * nearest activities in the country rather than the activities among the
       * nearest anything.
       */
      fetchNearbyLocations(supabase, {
        lat: coords.latitude,
        lng: coords.longitude,
        radiusM: HOME_RADIUS_M,
        sort: 'distance',
        kind: 'activity',
        maxResults: HOME_SECTION_LIMIT,
      })
        .then((rows) => {
          if (!cancelled) setNearbyActivities(rows);
        })
        .catch(() => {
          if (!cancelled) setNearbyActivities([]);
        });

      /*
       * Most liked, sorted in the database rather than here.
       *
       * The old client-side sort could only rank what the shared query had
       * already returned, so it meant "best rated within about 18 km" without
       * saying so. Now it is the fifteen best rated within the near-you radius.
       *
       * The tie-break changes with it: the RPC settles equal ratings by
       * distance, where this screen used to settle them by review count. For a
       * section headed "near you" proximity is the better answer, and equal
       * ratings are the common case — only four locations within 30 km of the
       * owner have been reviewed at all.
       */
      fetchNearbyLocations(supabase, {
        lat: coords.latitude,
        lng: coords.longitude,
        radiusM: HOME_NEARBY_RADIUS_M,
        sort: 'rating',
        maxResults: HOME_SECTION_LIMIT,
      })
        .then((rows) => {
          if (!cancelled) setNearbyMostLiked(rows);
        })
        .catch(() => {
          if (!cancelled) setNearbyMostLiked([]);
        });

      // One query per season, filtered in the database — so this is the nearest
      // fifteen of that season, not whichever fifteen survived a general
      // proximity query.
      (['summer', 'winter'] as const).forEach((season) => {
        fetchNearbyLocations(supabase, {
          lat: coords.latitude,
          lng: coords.longitude,
          radiusM: HOME_NEARBY_RADIUS_M,
          sort: 'distance',
          season,
          maxResults: HOME_SECTION_LIMIT,
        })
          .then((rows) => {
            if (cancelled) return;
            if (season === 'summer') setNearbySummer(rows);
            else setNearbyWinter(rows);
          })
          .catch(() => {
            if (cancelled) return;
            if (season === 'summer') setNearbySummer([]);
            else setNearbyWinter([]);
          });
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

  const handleStatPress = (id: StatId) => {
    if (id === 'reviews') {
      router.push('/my-reviews');
      return;
    }
    if (id === 'added' || id === 'activities') {
      router.push('/my-locations' as never);
      return;
    }
    if (id === 'lists') {
      router.push('/lists' as never);
      return;
    }
    const section = STAT_SECTIONS[id];
    if (section) router.push({ pathname: '/favorites', params: { section } });
  };

  // Every carousel is now exactly what its query asked for; the database did
  // the filtering, the sorting and the capping. Only boosted still needs work
  // done here, because is_boosted is not something the RPC filters on.
  const activities = nearbyActivities;
  const boosted = nearby.filter((l) => l.is_boosted).slice(0, HOME_SECTION_LIMIT);
  const mostLiked = nearbyMostLiked;
  const summerActivities = nearbySummer;
  const winterActivities = nearbyWinter;

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
                {t('home.tagline')}
              </ThemedText>
            </View>
          </View>

          <HomeSection
            title={t('home.activities')}
            onShowMore={() => router.push({ pathname: '/search', params: { kind: 'activity' } })}
            items={activities}
            keyExtractor={(item) => item.id}
            cardWidth={108}
            renderItem={renderLocationCard}
            emptyText={t('home.activitiesEmpty')}
          />

          {SHOW_BOOSTED_SECTION && (
            <HomeSection
              title={t('home.boosted')}
              onShowMore={() => router.push('/search')}
              items={boosted}
              keyExtractor={(item) => item.id}
              cardWidth={108}
              renderItem={renderBoostedCard}
              emptyText={t('home.boostedEmpty')}
            />
          )}

          <HomeSection
            title={t('home.sharedLists')}
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
            emptyText={t('home.sharedListsEmpty')}
          />

          <View style={styles.statsSection}>
            {session ? (
              <>
                <ThemedText type="smallBold" style={styles.statsTitle}>
                  {t('home.statsTitle')}
                </ThemedText>
                <View style={styles.tileGrid}>
                  {statTiles(stats).map((tile) => (
                    <Pressable key={tile.id} style={styles.statTile} onPress={() => handleStatPress(tile.id)}>
                      <ThemedText style={[styles.statValue, { color: tile.color }]}>{tile.value}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel} numberOfLines={1}>
                        {t(STAT_LABELS[tile.id])}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <>
                <ThemedText type="smallBold" style={styles.statsTitle}>
                  {t('home.ctaTitle')}
                </ThemedText>
                <View style={styles.ctaGrid}>
                  {[CTA_TILES.slice(0, 4), CTA_TILES.slice(4, 8)].map((row, rowIndex) => (
                    <View key={rowIndex} style={styles.ctaRow}>
                      {row.map((tile) => (
                        <Pressable
                          key={tile.id}
                          style={[styles.ctaTile, { backgroundColor: tile.color }]}
                          onPress={() => router.push('/sign-in')}>
                          <ThemedText type="smallBold" style={styles.ctaTileText}>
                            {t(`home.cta.${tile.id}.line1`)}
                          </ThemedText>
                          <ThemedText type="smallBold" style={styles.ctaTileText}>
                            {t(`home.cta.${tile.id}.line2`)}
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
            title={t('home.mostLiked')}
            onShowMore={() => router.push({ pathname: '/search', params: { sort: 'rating' } })}
            items={mostLiked}
            keyExtractor={(item) => item.id}
            cardWidth={108}
            renderItem={renderLocationCard}
            emptyText={t('home.mostLikedEmpty')}
          />

          <HomeSection
            title={t('home.summer')}
            onShowMore={() => router.push({ pathname: '/search', params: { season: 'summer' } })}
            items={summerActivities}
            keyExtractor={(item) => item.id}
            cardWidth={108}
            renderItem={renderLocationCard}
            emptyText={t('home.summerEmpty')}
          />

          <HomeSection
            title={t('home.winter')}
            onShowMore={() => router.push({ pathname: '/search', params: { season: 'winter' } })}
            items={winterActivities}
            keyExtractor={(item) => item.id}
            cardWidth={108}
            renderItem={renderLocationCard}
            emptyText={t('home.winterEmpty')}
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
