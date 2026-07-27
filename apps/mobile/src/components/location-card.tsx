import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { CategoryColors, SearchPalette, Spacing } from '@/constants/theme';
import { openDirections } from '@/lib/directions';
import type { CardLocation } from '@/types/location';

const IMAGE_WIDTH = 100;
// Used only for the very first paint, before onLayout reports the content column's real height.
const FALLBACK_IMAGE_HEIGHT = 96;

function formatCardDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function cityCountryLabel(location: CardLocation): string | null {
  const parts = [location.city, location.country].filter((part): part is string => Boolean(part && part.trim()));
  return parts.length > 0 ? parts.join(', ') : null;
}

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
  const categoryColor = CategoryColors[location.categorySlug] ?? CategoryColors.default;
  const cityCountry = cityCountryLabel(location);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const handleContentLayout = (event: LayoutChangeEvent) => {
    setContentHeight(event.nativeEvent.layout.height);
  };

  return (
    <Pressable style={[styles.card, { borderColor: categoryColor }]} onPress={onPress}>
      <View style={styles.mainRow}>
        <View style={[styles.imageWrapper, { height: contentHeight ?? FALLBACK_IMAGE_HEIGHT }]}>
          <Image source={{ uri: location.imageUrl }} style={styles.image} contentFit="cover" />
          <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
            <ThemedText type="small" style={styles.categoryBadgeText} numberOfLines={1}>
              {location.categoryLabel.toUpperCase()}
            </ThemedText>
          </View>
        </View>

        <View style={styles.content} onLayout={handleContentLayout}>
          <View style={styles.titleRow}>
            <ThemedText type="smallBold" style={styles.titleText} numberOfLines={1}>
              {location.name}
            </ThemedText>
            <View style={styles.iconRow}>
              <Pressable onPress={onToggleFavorite} hitSlop={8}>
                <Ionicons
                  name={isFavorite ? 'heart' : 'heart-outline'}
                  size={19}
                  color={isFavorite ? '#4CD37A' : SearchPalette.text}
                />
              </Pressable>
              <Pressable onPress={onToggleBucketList} hitSlop={8}>
                <Ionicons
                  name={isBucketListed ? 'bookmark' : 'bookmark-outline'}
                  size={19}
                  color={isBucketListed ? SearchPalette.accent : SearchPalette.text}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color={SearchPalette.accent} />
            <ThemedText type="smallBold" style={styles.ratingText}>
              {location.rating.toFixed(1)}
            </ThemedText>
            <ThemedText type="small" style={styles.mutedText}>
              ({location.reviewCount})
            </ThemedText>
          </View>

          {location.kind === 'activity' && location.startsAt && (
            <ThemedText type="small" style={[styles.mutedText, styles.startsAtText]}>
              📅 {formatCardDate(location.startsAt)}
            </ThemedText>
          )}

          {location.address ? (
            <ThemedText type="small" numberOfLines={1} style={[styles.mutedText, styles.addressLine]}>
              {location.address}
            </ThemedText>
          ) : location.distanceKm !== null ? (
            <ThemedText type="small" numberOfLines={1} style={[styles.mutedText, styles.addressLine]}>
              ~{location.distanceKm} km from city
            </ThemedText>
          ) : null}

          <View style={styles.bottomRow}>
            {cityCountry ? (
              <ThemedText type="small" numberOfLines={1} style={[styles.mutedText, styles.bottomRowFill]}>
                {cityCountry}
              </ThemedText>
            ) : (
              <View style={styles.bottomRowFill} />
            )}
            <Pressable
              style={styles.directionsButton}
              onPress={() => openDirections(location.address ?? location.name)}
              hitSlop={8}>
              <ThemedText type="smallBold" style={styles.directionsText}>
                Direction
              </ThemedText>
              <Ionicons name="arrow-forward" size={14} color={SearchPalette.text} />
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: SearchPalette.card,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  imageWrapper: {
    width: IMAGE_WIDTH,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  categoryBadge: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 4,
  },
  categoryBadgeText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    padding: Spacing.three,
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
    fontSize: 15.5,
    lineHeight: 20,
    color: SearchPalette.text,
  },
  iconRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  ratingText: {
    color: SearchPalette.text,
  },
  mutedText: {
    color: SearchPalette.textMuted,
  },
  startsAtText: {
    marginTop: Spacing.half,
  },
  addressLine: {
    marginTop: Spacing.half,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.half,
  },
  bottomRowFill: {
    flex: 1,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  directionsText: {
    color: SearchPalette.text,
  },
});
