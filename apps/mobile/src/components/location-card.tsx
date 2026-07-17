import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { StarRating } from '@/components/star-rating';
import { ThemedText } from '@/components/themed-text';
import { CategoryColors, Spacing } from '@/constants/theme';
import { openDirections } from '@/lib/directions';
import type { CardLocation } from '@/types/location';

const IMAGE_HEIGHT = 160;

export function LocationCard({
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
  const cardColor = CategoryColors[location.categorySlug] ?? CategoryColors.default;

  return (
    <Pressable style={[styles.card, { backgroundColor: cardColor }]} onPress={onPress}>
      <View style={styles.mainRow}>
        <View style={styles.imageWrapper}>
          <Image source={{ uri: location.imageUrl }} style={styles.image} contentFit="cover" />
          <View style={[styles.categoryBadge, { backgroundColor: cardColor }]}>
            <ThemedText type="small" style={styles.whiteText} numberOfLines={1}>
              {location.categoryLabel}
            </ThemedText>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <ThemedText type="smallBold" style={[styles.whiteText, styles.titleText]} numberOfLines={1}>
              {location.name}
            </ThemedText>
            <View style={styles.iconRow}>
              <Pressable onPress={onToggleFavorite} hitSlop={8}>
                <ThemedText style={isFavorite ? styles.iconActiveFavorite : styles.iconInactive}>
                  {isFavorite ? '♥' : '♡'}
                </ThemedText>
              </Pressable>
              <Pressable onPress={onToggleBucketList} hitSlop={8}>
                <ThemedText style={isBucketListed ? styles.iconActiveBucket : styles.iconInactive}>
                  {isBucketListed ? '★' : '☆'}
                </ThemedText>
              </Pressable>
            </View>
          </View>
          <View style={styles.ratingRow}>
            <StarRating rating={location.rating} />
            <ThemedText type="small" style={styles.whiteText}>
              {location.rating.toFixed(1)} ({location.reviewCount})
            </ThemedText>
          </View>
          <ThemedText type="small" style={[styles.whiteText, styles.description]} numberOfLines={3}>
            {location.description}
          </ThemedText>
        </View>
      </View>

      <View style={styles.footerRow}>
        {location.address ? (
          <ThemedText type="small" style={[styles.whiteText, styles.addressText]} numberOfLines={1}>
            {location.address}
          </ThemedText>
        ) : location.distanceKm !== null ? (
          <ThemedText type="small" style={[styles.whiteTextSecondary, styles.addressText]} numberOfLines={1}>
            ~{location.distanceKm} km from city
          </ThemedText>
        ) : (
          <View />
        )}
        <Pressable onPress={() => openDirections(location.address ?? location.name)}>
          <ThemedText type="smallBold" style={[styles.whiteText, styles.directionsText]}>
            Directions
          </ThemedText>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  mainRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  imageWrapper: {
    width: '48%',
    height: IMAGE_HEIGHT,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: Spacing.three,
  },
  categoryBadge: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.five,
  },
  content: {
    flex: 1,
    paddingTop: Spacing.one,
    paddingRight: Spacing.three,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  titleText: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.half,
  },
  iconRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  iconInactive: {
    color: '#ffffff',
    fontSize: 26,
  },
  iconActiveFavorite: {
    color: '#4CD37A',
    fontSize: 26,
  },
  iconActiveBucket: {
    color: '#F5C242',
    fontSize: 26,
  },
  whiteText: {
    color: '#ffffff',
  },
  whiteTextSecondary: {
    color: 'rgba(255,255,255,0.75)',
  },
  description: {
    color: 'rgba(255,255,255,0.85)',
    marginTop: Spacing.three,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
  },
  addressText: {
    flex: 1,
    marginRight: Spacing.two,
  },
  directionsText: {
    textDecorationLine: 'underline',
  },
});
