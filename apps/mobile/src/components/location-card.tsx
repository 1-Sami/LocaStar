import { Image } from 'expo-image';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { CategoryColors, Spacing } from '@/constants/theme';
import type { CardLocation } from '@/types/location';

function openDirections(address: string) {
  const encoded = encodeURIComponent(address);
  const webFallback = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
  const url = Platform.select({
    ios: `https://maps.apple.com/?daddr=${encoded}`,
    android: `google.navigation:q=${encoded}`,
    default: webFallback,
  });
  Linking.openURL(url).catch(() => Linking.openURL(webFallback));
}

export function LocationCard({
  location,
  isFavorite,
  isBucketListed,
  onToggleFavorite,
  onToggleBucketList,
}: {
  location: CardLocation;
  isFavorite: boolean;
  isBucketListed: boolean;
  onToggleFavorite: () => void;
  onToggleBucketList: () => void;
}) {
  const cardColor = CategoryColors[location.categorySlug] ?? CategoryColors.default;

  return (
    <View style={[styles.card, { backgroundColor: cardColor }]}>
      <View style={styles.mainRow}>
        <Image source={{ uri: location.imageUrl }} style={styles.image} contentFit="cover" />

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
          <ThemedText type="small" style={styles.whiteText}>
            ★ {location.rating.toFixed(1)} · {location.reviewCount} reviews
          </ThemedText>
          <ThemedText type="small" style={[styles.whiteText, styles.description]} numberOfLines={3}>
            {location.description}
          </ThemedText>
        </View>
      </View>

      <View style={styles.footerRow}>
        {location.distanceKm !== null ? (
          <ThemedText type="small" style={styles.whiteTextSecondary}>
            ~{location.distanceKm} km from city
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
  );
}

const IMAGE_SIZE = 96;

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  mainRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  image: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: Spacing.two,
  },
  content: {
    flex: 1,
    gap: Spacing.half,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  titleText: {
    flex: 1,
  },
  iconRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  iconInactive: {
    color: '#ffffff',
    fontSize: 18,
  },
  iconActiveFavorite: {
    color: '#4CD37A',
    fontSize: 18,
  },
  iconActiveBucket: {
    color: '#F5C242',
    fontSize: 18,
  },
  whiteText: {
    color: '#ffffff',
  },
  whiteTextSecondary: {
    color: 'rgba(255,255,255,0.75)',
  },
  description: {
    color: 'rgba(255,255,255,0.85)',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.25)',
  },
});
