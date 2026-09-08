import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { LocationPhoto } from '@/components/location-photo';
import { STAR_COLOR } from '@/components/star-rating';
import { ThemedText } from '@/components/themed-text';
import { CategoryColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { categoryLabel } from '@/lib/categories';
import { formatDistance } from '@/lib/distance';
import type { CardLocation } from '@/types/location';

const IMAGE_HEIGHT = 110;
/** Saved. The card's own pink, not the green the map and search cards use. */
const FAVORITE_COLOR = '#F5738A';
/** Both overlay icons, so the pair cannot drift apart again. */
const ICON_SIZE = 15;

/** Whole days from now until then; negative once it has started. */
function daysUntil(iso: string): number {
  const start = new Date(iso);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(start) - startOfDay(new Date())) / 86_400_000);
}

/**
 * One saved place, as a card in a grid.
 *
 * Saved used to be three sections in two different shapes: Favourites in a
 * grid, Bookmarks and Shared with me as wide rows — a photo on the left and a
 * column of text beside it, one per line, so a dozen saved places ran for
 * several screens and none of them showed much. This is the one shape all three
 * use now.
 *
 * What it says under the name is whichever of three things is true, in this
 * order: when an event starts, then the rating, then that nobody has rated it.
 * The old card said "Directions" there, which is a thing to do rather than
 * something to know, and it was the only thing it offered about the place.
 */
export function SavedCard({
  location,
  isFavorite,
  isBucketListed,
  onToggleFavorite,
  onToggleBucketList,
  onPress,
}: {
  location: CardLocation;
  isFavorite: boolean;
  isBucketListed: boolean;
  onToggleFavorite: () => void;
  onToggleBucketList: () => void;
  onPress?: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const categoryColor = CategoryColors[location.categorySlug] ?? CategoryColors.default;
  const label = categoryLabel(t, location.categorySlug, location.categoryLabel);

  const left = location.startsAt ? daysUntil(location.startsAt) : null;
  const distance = formatDistance(location.distanceM);

  return (
    <Pressable
      style={[styles.card, { backgroundColor: theme.backgroundElement }]}
      onPress={onPress}
      accessibilityRole="button">
      <View style={styles.imageWrapper}>
        <LocationPhoto url={location.imageUrl} style={styles.image} iconSize={24} />

        {/* Over the photo, so the card reads as one object rather than a
            picture with a caption stuck underneath it. */}
        <View style={[styles.badge, { backgroundColor: categoryColor }]}>
          <ThemedText type="small" style={styles.badgeText} numberOfLines={1}>
            {label.toUpperCase()}
            {left !== null && left >= 0 ? ` · ${t('saved.daysLeft', { count: left })}` : ''}
          </ThemedText>
        </View>

        <View style={styles.iconRow}>
          <Pressable
            style={styles.iconButton}
            onPress={onToggleFavorite}
            hitSlop={8}
            accessibilityLabel={t('saved.favorites')}>
            {/* An icon, not the ♥ / ♡ characters this used to draw. A text
                heart is whatever font the platform finds for it: U+2665 is
                common and U+2661 is not, so filled and hollow resolved to
                different faces and came out at different sizes on Android,
                while iOS picked one that drew both far smaller than the
                bookmark beside them. fontSize is the em box, not the ink;
                an icon's size is the icon. */}
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={ICON_SIZE}
              color={isFavorite ? FAVORITE_COLOR : '#ffffff'}
            />
          </Pressable>
          <Pressable
            style={styles.iconButton}
            onPress={onToggleBucketList}
            hitSlop={8}
            accessibilityLabel={t('saved.bucketList')}>
            <Ionicons
              name={isBucketListed ? 'bookmark' : 'bookmark-outline'}
              size={ICON_SIZE}
              color={isBucketListed ? '#F5C242' : '#ffffff'}
            />
          </Pressable>
        </View>
      </View>

      <View style={styles.body}>
        <ThemedText type="smallBold" numberOfLines={2} style={styles.name}>
          {location.name}
        </ThemedText>

        {location.startsAt ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {new Date(location.startsAt)
              .toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
              .toUpperCase()}
          </ThemedText>
        ) : location.reviewCount > 0 ? (
          <View style={styles.metaRow}>
            <Ionicons name="star" size={11} color={STAR_COLOR} />
            <ThemedText type="smallBold" style={styles.rating}>
              {location.rating.toFixed(1)}
            </ThemedText>
            {distance && (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                · {distance}
              </ThemedText>
            )}
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.unrated}>
            {t('saved.notRatedYet')}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageWrapper: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: IMAGE_HEIGHT,
  },
  badge: {
    position: 'absolute',
    left: Spacing.two,
    bottom: Spacing.two,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Spacing.five,
    maxWidth: '90%',
  },
  badgeText: {
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.4,
    color: '#ffffff',
  },
  iconRow: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one,
    flexDirection: 'row',
    gap: Spacing.one,
  },
  iconButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    // A scrim, because these sit on a photograph whose brightness is unknown.
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  body: {
    padding: Spacing.two,
    gap: 3,
  },
  name: {
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  rating: {
    fontSize: 12,
  },
  unrated: {
    fontSize: 11,
    letterSpacing: 0.3,
  },
});
