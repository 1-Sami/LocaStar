import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { LocationPhoto } from '@/components/location-photo';
import { ThemedText } from '@/components/themed-text';
import { CategoryColors, SearchPalette, Spacing } from '@/constants/theme';
import { openDirections } from '@/lib/directions';
import { formatDistance } from '@/lib/distance';
import type { CardLocation } from '@/types/location';

const IMAGE_WIDTH = 116;
// Used only for the very first paint, before onLayout reports the content column's real height.
const FALLBACK_IMAGE_HEIGHT = 96;

function formatCardDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The address as the two lines the card prints: street, then postcode and city.
 *
 * add-location and edit-location both store it as "<street>, <postcode city>",
 * so splitting on the LAST comma recovers exactly those halves — and a street
 * that contains a comma of its own ("Torg 1, uppg B") keeps it. Older rows can
 * carry the country on the end too; there is no room for it on a card and it is
 * the least useful part, so it comes off first.
 */
function addressLines(location: CardLocation): { street: string | null; area: string | null } {
  const city = location.city?.trim() || null;
  let address = location.address?.trim() ?? '';

  const country = location.country?.trim();
  if (country) {
    const stripped = address
      .replace(new RegExp(`[,\\s]*${escapeForRegExp(country)}\\s*$`, 'i'), '')
      .replace(/[,\s]+$/, '');
    // Keep the original if trimming would leave nothing to show.
    if (stripped) address = stripped;
  }

  if (!address) return { street: null, area: city };

  const cut = address.lastIndexOf(',');
  if (cut === -1) {
    // Nothing to split on. If the row carries a city column and the address
    // does not already end with it, that becomes the second line.
    const endsWithCity = city !== null && new RegExp(`${escapeForRegExp(city)}$`, 'i').test(address);
    return { street: address, area: endsWithCity ? null : city };
  }

  return {
    street: address.slice(0, cut).trim() || null,
    area: address.slice(cut + 1).trim() || null,
  };
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
  const { t } = useTranslation();
  const categoryColor = CategoryColors[location.categorySlug] ?? CategoryColors.default;
  const { street, area } = addressLines(location);
  const distance = formatDistance(location.distanceM);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const handleContentLayout = (event: LayoutChangeEvent) => {
    setContentHeight(event.nativeEvent.layout.height);
  };

  return (
    <Pressable style={[styles.card, { borderColor: categoryColor }]} onPress={onPress}>
      <View style={styles.mainRow}>
        <View style={[styles.imageWrapper, { height: contentHeight ?? FALLBACK_IMAGE_HEIGHT }]}>
          <LocationPhoto url={location.imageUrl} style={styles.image} iconSize={26} />
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

          {/* Street and postcode/city get a line each, the way an address is
              written on an envelope. Squeezed onto one line they ran past the
              edge and truncated mid-postcode. */}
          {street && (
            <ThemedText type="small" numberOfLines={1} style={[styles.mutedText, styles.addressLine]}>
              {street}
            </ThemedText>
          )}
          {area && (
            <ThemedText type="small" numberOfLines={1} style={styles.mutedText}>
              {area}
            </ThemedText>
          )}

          <View style={styles.bottomRow}>
            {/* The old copy here read "~N km from city", which named the wrong
                origin — nearby_locations measures from the searching user, not
                from the town centre. Always rendered, distance or not, so
                "Direction" stays pinned to the right edge either way. */}
            <View style={[styles.bottomRowFill, styles.placeRow]}>
              {distance && (
                <View style={styles.distanceChip}>
                  <Ionicons name="navigate-outline" size={11} color={SearchPalette.textMuted} />
                  <ThemedText type="small" style={styles.mutedText}>
                    {distance}
                  </ThemedText>
                </View>
              )}
            </View>
            <Pressable
              style={styles.directionsButton}
              onPress={() => openDirections(location.coords, location.name)}
              hitSlop={8}>
              <ThemedText type="smallBold" style={styles.directionsText}>
                {t('components.directions')}
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
    left: Spacing.half,
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
    // Tighter top and bottom than the sides. The second address line has to
    // come from somewhere, and there was more air above the title than the
    // layout needed — so the card gains a line without growing.
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
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
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  distanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
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
