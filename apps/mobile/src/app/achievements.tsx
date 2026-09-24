import {
  fetchMyAchievementCounts,
  fetchProfile,
  hasAchievements,
  summarise,
  type Achievements,
  type BadgeGroup,
  type BadgeId,
  type BadgeState,
  type ScoreLineId,
} from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { markBadgesSeen } from '@/lib/achievements-seen';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

const AMBER = '#E8A93B';

const BADGE_ICONS: Record<BadgeId, keyof typeof Ionicons.glyphMap> = {
  firstOnTheMap: 'star-outline',
  pioneer: 'aperture-outline',
  mapmaker: 'map-outline',
  eventHost: 'calendar-outline',
  knowsTheArea: 'home-outline',
  explorer: 'compass-outline',
  wellTravelled: 'airplane-outline',
  specialist: 'ribbon-outline',
  photographer: 'camera-outline',
  regular: 'create-outline',
  allSeasons: 'snow-outline',
};

const GROUPS: BadgeGroup[] = ['coverage', 'range', 'habit'];

/** I, II, III — three is as far as any badge tiers, so a table beats maths. */
const NUMERALS = ['', 'I', 'II', 'III'];

const LINE_ORDER: ScoreLineId[] = [
  'placesAdded',
  'firstPhotos',
  'eventsAdded',
  'otherPhotos',
  'reviews',
  'firstReviews',
  'reviewsWithPhoto',
  'reportsUpheld',
];

function badgeLabel(t: (key: string) => string, badge: BadgeState): string {
  const name = t(`achievements.badge.${badge.id}.name`);
  return badge.tier > 0 ? `${name} ${NUMERALS[badge.tier]}` : name;
}

/**
 * A progress bar that is honest about zero.
 *
 * A bar with nothing in it still draws its track, so "0 of 25" reads as a thing
 * not started rather than as a thing that failed to load.
 */
function Bar({ fraction, height = 6 }: { fraction: number; height?: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.barTrack, { height, backgroundColor: theme.backgroundSelected }]}>
      <View
        style={[
          styles.barFill,
          { height, width: `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%` },
        ]}
      />
    </View>
  );
}

export default function AchievementsScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();

  const [data, setData] = useState<Achievements | null>(null);
  const [allowed, setAllowed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const gridWidth = Math.min(windowWidth, MaxContentWidth) - Spacing.three * 2;
  const tileWidth = Math.floor((gridWidth - Spacing.two * 2) / 3);

  useFocusEffect(
    useCallback(() => {
      // Reachable signed out by going back far enough. Without this the screen
      // sits on its spinner forever, because nothing ever resolves to turn it
      // off — a blank wait is a worse answer than an honest one.
      if (!session) {
        setLoading(false);
        setLoadFailed(true);
        return;
      }
      let cancelled = false;
      setLoading(true);
      Promise.all([
        fetchMyAchievementCounts(supabase),
        fetchProfile(supabase, session.user.id),
      ])
        .then(([counts, profile]) => {
          if (cancelled) return;
          setLoadFailed(false);
          setAllowed(hasAchievements(profile.role));
          const summary = summarise(counts);
          setData(summary);
          // Opening the screen is what makes them no longer new, so the count
          // on the Profile row clears the moment they have actually been seen.
          const earned = summary.badges.filter((b) => b.earned).map((b) => b.key);
          void markBadgesSeen(session.user.id, earned);
        })
        .catch((err) => {
          // Never zeros: a screen full of noughts is a statement that this
          // person has contributed nothing, which is a thing to say about them
          // rather than about a failed request.
          console.error('Failed to load achievements', err);
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

  if (loading && !data) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <ActivityIndicator style={styles.spinner} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (loadFailed && !data) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <ThemedText type="default" themeColor="textSecondary" style={styles.notice}>
            {t('achievements.loadFailed')}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // Reachable by going back to a screen opened before a role changed, so it
  // says why rather than quietly showing an empty shelf.
  if (!allowed) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <ThemedText type="default" themeColor="textSecondary" style={styles.notice}>
            {t('achievements.notForThisAccount')}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!data) return null;

  const { level, closest, badges, lines } = data;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.levelHead}>
              <View style={styles.medal}>
                <Ionicons name="medal" size={20} color="#201603" />
              </View>
              <View style={styles.levelText}>
                <ThemedText type="smallBold" style={styles.levelName}>
                  {t(`achievements.level.${level.id}`)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('achievements.levelOf', { number: level.number, total: 8 })}
                </ThemedText>
              </View>
              <View style={styles.pointsBlock}>
                <ThemedText style={styles.pointsValue}>{data.points}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('achievements.points')}
                </ThemedText>
              </View>
            </View>
            <Bar fraction={level.fraction} />
            <ThemedText type="small" themeColor="textSecondary">
              {level.next
                ? t('achievements.toNext', {
                    points: level.pointsToNext,
                    level: t(`achievements.level.${level.next.id}`),
                  })
                : t('achievements.atTheTop')}
            </ThemedText>
          </ThemedView>

          {closest.length > 0 && (
            <>
              <ThemedText type="smallBold" style={styles.sectionLabel}>
                {t('achievements.closest')}
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.card}>
                {closest.map((badge) => (
                  <View key={badge.key} style={styles.nearRow}>
                    <View style={[styles.nearGlyph, { backgroundColor: theme.backgroundSelected }]}>
                      <Ionicons
                        name={BADGE_ICONS[badge.id]}
                        size={15}
                        color={theme.textSecondary}
                      />
                    </View>
                    <View style={styles.nearGrow}>
                      <ThemedText type="small" style={styles.nearName}>
                        {badgeLabel(t, badge)}
                      </ThemedText>
                      {/* What the number is counting. A bar reading 2/5 with
                          only "Explorer" above it is a riddle; this is the one
                          place on the screen with room to answer it. */}
                      <ThemedText
                        type="small"
                        themeColor="textSecondary"
                        style={styles.nearNeed}
                        numberOfLines={1}
                      >
                        {t(`achievements.badge.${badge.id}.need`)}
                      </ThemedText>
                      <Bar fraction={badge.fraction} height={4} />
                    </View>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.nearCount}>
                      {badge.have}/{badge.need}
                    </ThemedText>
                  </View>
                ))}
              </ThemedView>
            </>
          )}

          <ThemedText type="smallBold" style={styles.sectionLabel}>
            {t('achievements.earnedOf', { earned: data.earnedCount, total: data.totalCount })}
          </ThemedText>

          {GROUPS.map((group) => (
            <View key={group} style={styles.group}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.groupLabel}>
                {t(`achievements.group.${group}`)}
              </ThemedText>
              <View style={styles.grid}>
                {badges
                  .filter((badge) => badge.group === group)
                  .map((badge) => (
                    <ThemedView
                      key={badge.key}
                      type="backgroundElement"
                      style={[
                        styles.tile,
                        { width: tileWidth },
                        badge.earned && styles.tileEarned,
                      ]}
                    >
                      <View
                        style={[
                          styles.tileGlyph,
                          {
                            backgroundColor: badge.earned ? AMBER : theme.backgroundSelected,
                          },
                        ]}
                      >
                        <Ionicons
                          name={BADGE_ICONS[badge.id]}
                          size={16}
                          color={badge.earned ? '#201603' : theme.textSecondary}
                        />
                      </View>
                      <ThemedText
                        type="small"
                        style={styles.tileName}
                        numberOfLines={2}
                        themeColor={badge.earned ? 'text' : 'textSecondary'}
                      >
                        {badgeLabel(t, badge)}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.tileMeta}>
                        {badge.earned
                          ? t('achievements.bonus', { points: badge.bonus })
                          : `${badge.have}/${badge.need}`}
                      </ThemedText>
                    </ThemedView>
                  ))}
              </View>
            </View>
          ))}

          <ThemedText type="smallBold" style={styles.sectionLabel}>
            {t('achievements.howPoints')}
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.card}>
            {LINE_ORDER.map((id) => {
              const entry = lines.find((candidate) => candidate.id === id);
              if (!entry) return null;
              return (
                <View key={id} style={styles.lineRow}>
                  <ThemedText type="small" style={styles.lineName}>
                    {t(`achievements.line.${id}`)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.lineEach}>
                    {entry.count} × {entry.each}
                  </ThemedText>
                  <ThemedText type="smallBold" style={styles.linePoints}>
                    {entry.points}
                  </ThemedText>
                </View>
              );
            })}
            <View style={[styles.lineRow, styles.lineTotal, { borderTopColor: theme.backgroundSelected }]}>
              <ThemedText type="small" style={styles.lineName}>
                {t('achievements.fromBadges')}
              </ThemedText>
              <ThemedText type="smallBold" style={styles.linePoints}>
                {data.badgePoints}
              </ThemedText>
            </View>
          </ThemedView>

          <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
            {t('achievements.footnote')}
          </ThemedText>
        </ScrollView>
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
  content: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four * 2,
    gap: Spacing.two,
  },
  spinner: { marginTop: Spacing.four },
  notice: {
    marginTop: Spacing.four,
    paddingHorizontal: Spacing.three,
    textAlign: 'center',
  },
  card: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  levelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  medal: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: AMBER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelText: { flex: 1 },
  levelName: { fontSize: 16, lineHeight: 21 },
  pointsBlock: { alignItems: 'flex-end' },
  pointsValue: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    color: AMBER,
  },
  barTrack: {
    width: '100%',
    borderRadius: 99,
    overflow: 'hidden',
  },
  barFill: {
    borderRadius: 99,
    backgroundColor: AMBER,
  },
  sectionLabel: {
    marginTop: Spacing.two,
    fontSize: 15,
    lineHeight: 20,
  },
  nearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  nearGlyph: {
    width: 28,
    height: 28,
    borderRadius: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearGrow: { flex: 1, gap: 4 },
  nearName: { fontWeight: '600' },
  nearNeed: { fontSize: 11, lineHeight: 15 },
  nearCount: { minWidth: 44, textAlign: 'right' },
  group: { gap: Spacing.one },
  groupLabel: { marginTop: Spacing.one },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tile: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tileEarned: { borderColor: AMBER },
  tileGlyph: {
    width: 30,
    height: 30,
    borderRadius: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileName: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
  },
  tileMeta: { fontSize: 10, lineHeight: 13 },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  lineName: { flex: 1 },
  lineEach: { minWidth: 52, textAlign: 'right' },
  linePoints: { minWidth: 40, textAlign: 'right', color: AMBER },
  lineTotal: {
    borderTopWidth: 1,
    paddingTop: Spacing.two,
    marginTop: Spacing.one,
  },
  footnote: {
    marginTop: Spacing.two,
    fontSize: 12,
    lineHeight: 17,
  },
});
