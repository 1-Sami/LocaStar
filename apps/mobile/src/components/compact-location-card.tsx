import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { StarRating } from '@/components/star-rating';
import { ThemedText } from '@/components/themed-text';
import { CategoryColors, Spacing } from '@/constants/theme';
import type { CardLocation } from '@/types/location';

const IMAGE_HEIGHT = 100;

export function CompactLocationCard({
  location,
  isBucketListed,
  onToggleBucketList,
  onPress,
  showBoostedBadge,
}: {
  location: CardLocation;
  isBucketListed: boolean;
  onToggleBucketList: () => void;
  onPress?: () => void;
  showBoostedBadge?: boolean;
}) {
  const cardColor = CategoryColors[location.categorySlug] ?? CategoryColors.default;

  return (
    <Pressable style={[styles.card, { backgroundColor: cardColor }]} onPress={onPress}>
      <View style={styles.imageWrapper}>
        <Image source={{ uri: location.imageUrl }} style={styles.image} contentFit="cover" />
        <View style={[styles.categoryBadge, { backgroundColor: cardColor }]}>
          <ThemedText type="small" style={[styles.whiteText, styles.badgeText]} numberOfLines={1}>
            {location.categoryLabel}
          </ThemedText>
        </View>
        {showBoostedBadge && (
          <View style={styles.boostedBadge}>
            <ThemedText type="small" style={[styles.whiteText, styles.badgeText]} numberOfLines={1}>
              ★ Boosted
            </ThemedText>
          </View>
        )}
        <Pressable style={styles.bucketButton} onPress={onToggleBucketList} hitSlop={8}>
          <ThemedText style={isBucketListed ? styles.iconActiveBucket : styles.iconInactive}>
            {isBucketListed ? '★' : '☆'}
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.content}>
        <ThemedText type="smallBold" style={[styles.whiteText, styles.name]} numberOfLines={1}>
          {location.name}
        </ThemedText>
        <View style={styles.ratingRow}>
          <StarRating rating={location.rating} size={10} />
          <ThemedText type="small" style={styles.whiteText} numberOfLines={1}>
            {location.rating.toFixed(1)} ({location.reviewCount})
          </ThemedText>
        </View>
        <ThemedText type="small" style={styles.whiteTextSecondary} numberOfLines={1}>
          {location.address ?? (location.distanceKm !== null ? `~${location.distanceKm} km` : '')}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.two,
    padding: Spacing.one,
    overflow: 'hidden',
  },
  imageWrapper: {
    width: '100%',
    height: IMAGE_HEIGHT,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: Spacing.one,
  },
  categoryBadge: {
    position: 'absolute',
    top: Spacing.one,
    left: Spacing.one,
    paddingHorizontal: Spacing.one,
    paddingVertical: 1,
    borderRadius: Spacing.five,
    maxWidth: '70%',
  },
  boostedBadge: {
    position: 'absolute',
    bottom: Spacing.one,
    left: Spacing.one,
    backgroundColor: '#E8A93B',
    paddingHorizontal: Spacing.one,
    paddingVertical: 1,
    borderRadius: Spacing.five,
  },
  badgeText: {
    fontSize: 9,
    lineHeight: 12,
  },
  bucketButton: {
    position: 'absolute',
    top: Spacing.half,
    right: Spacing.half,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInactive: {
    color: '#ffffff',
    fontSize: 14,
  },
  iconActiveBucket: {
    color: '#F5C242',
    fontSize: 14,
  },
  content: {
    paddingTop: Spacing.one,
    paddingHorizontal: Spacing.half,
    paddingBottom: Spacing.half,
    gap: 2,
  },
  name: {
    fontSize: 13,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  whiteText: {
    color: '#ffffff',
  },
  whiteTextSecondary: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
  },
});
