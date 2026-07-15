import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { StarRating } from '@/components/star-rating';
import { ThemedText } from '@/components/themed-text';
import { CategoryColors, Spacing } from '@/constants/theme';
import { openDirections } from '@/lib/directions';
import type { CardLocation } from '@/types/location';

const CARD_HEIGHT = 168;

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
        <View style={styles.leftColumn}>
          <Image source={{ uri: location.imageUrl }} style={styles.image} contentFit="cover" />
          <View style={styles.captionRow}>
            {location.distanceKm !== null ? (
              <ThemedText type="small" style={styles.whiteTextSecondary} numberOfLines={1}>
                ~{location.distanceKm} km from city
              </ThemedText>
            ) : location.address ? (
              <ThemedText type="small" style={[styles.whiteTextSecondary, styles.addressText]} numberOfLines={1}>
                {location.address}
              </ThemedText>
            ) : (
              <View />
            )}
            <Pressable onPress={() => openDirections(location.address ?? location.name)}>
              <ThemedText type="smallBold" style={styles.whiteText}>
                Directions
              </ThemedText>
            </Pressable>
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
              {location.rating.toFixed(2)} · {location.reviewCount} reviews
            </ThemedText>
          </View>
          <ThemedText type="small" style={[styles.whiteText, styles.description]} numberOfLines={3}>
            {location.description}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    height: CARD_HEIGHT,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    overflow: 'hidden',
  },
  mainRow: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.three,
  },
  leftColumn: {
    width: '42%',
  },
  image: {
    width: '100%',
    flex: 1,
    borderRadius: Spacing.two,
  },
  captionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  addressText: {
    flex: 1,
    marginRight: Spacing.one,
  },
  content: {
    flex: 1,
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
});
