import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { CategoryColors } from '@/constants/theme';
import { Spacing } from '@/constants/theme';
import type { MockLocation } from '@/data/mock-locations';

export function LocationCard({ location }: { location: MockLocation }) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [isBucketListed, setIsBucketListed] = useState(false);
  const cardColor = CategoryColors[location.categorySlug] ?? CategoryColors.default;

  return (
    <View style={[styles.card, { backgroundColor: cardColor }]}>
      <View style={styles.imageWrapper}>
        <Image source={{ uri: location.imageUrl }} style={styles.image} contentFit="cover" />
        <View style={styles.iconRow}>
          <Pressable onPress={() => setIsFavorite((v) => !v)} hitSlop={8}>
            <ThemedText style={isFavorite ? styles.iconActiveFavorite : styles.iconInactive}>
              {isFavorite ? '♥' : '♡'}
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => setIsBucketListed((v) => !v)} hitSlop={8}>
            <ThemedText style={isBucketListed ? styles.iconActiveBucket : styles.iconInactive}>
              {isBucketListed ? '★' : '☆'}
            </ThemedText>
          </Pressable>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <ThemedText type="smallBold" style={styles.whiteText}>
            {location.name}
          </ThemedText>
        </View>
        <ThemedText type="small" style={styles.whiteText}>
          ★ {location.rating.toFixed(1)} · {location.reviewCount} reviews
        </ThemedText>
        <ThemedText type="small" style={[styles.whiteText, styles.description]} numberOfLines={3}>
          {location.description}
        </ThemedText>
        <View style={styles.footerRow}>
          <ThemedText type="small" style={styles.whiteTextSecondary}>
            ~{location.distanceKm} km from city
          </ThemedText>
          <ThemedText type="smallBold" style={styles.whiteText}>
            Directions
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  imageWrapper: {
    width: '100%',
    height: 140,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  iconRow: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  iconInactive: {
    color: '#ffffff',
    fontSize: 20,
  },
  iconActiveFavorite: {
    color: '#4CD37A',
    fontSize: 20,
  },
  iconActiveBucket: {
    color: '#F5C242',
    fontSize: 20,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.half,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  whiteText: {
    color: '#ffffff',
  },
  whiteTextSecondary: {
    color: 'rgba(255,255,255,0.75)',
  },
  description: {
    color: 'rgba(255,255,255,0.85)',
    marginTop: Spacing.half,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
});
