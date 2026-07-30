import type { LocationList } from '@locastar/shared';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { LocationPhoto } from '@/components/location-photo';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export function ListCard({
  list,
  ownerUsername,
  onPress,
  onToggleLike,
}: {
  list: LocationList;
  ownerUsername: string;
  onPress: () => void;
  onToggleLike: () => void;
}) {
  const [main, ...rest] = list.previewLocations;

  return (
    <Pressable onPress={onPress}>
      <View style={styles.card}>
        <ThemedText type="smallBold" style={[styles.whiteText, styles.cardTitle]}>
          {list.name}
        </ThemedText>
        <ThemedText type="small" style={[styles.whiteTextSecondary, styles.byline]}>
          by {ownerUsername}
        </ThemedText>

        <View style={styles.collage}>
          {main ? (
            <LocationPhoto url={main.imageUrl} style={styles.mainPhoto} iconSize={20} />
          ) : (
            <View style={[styles.mainPhoto, styles.photoPlaceholder]} />
          )}
          {rest.length > 0 && (
            <View style={styles.subPhotoRow}>
              {rest.map((preview) => (
                <LocationPhoto
                  key={preview.locationId}
                  url={preview.imageUrl}
                  style={styles.subPhoto}
                  iconSize={14}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.footerRow}>
          <View style={styles.footerLeft}>
            <Pressable style={styles.likeButton} onPress={onToggleLike} hitSlop={8}>
              <Ionicons
                name={list.likedByMe ? 'thumbs-up' : 'thumbs-up-outline'}
                size={14}
                color={list.likedByMe ? '#4CD37A' : '#ffffff'}
              />
              <ThemedText type="smallBold" style={styles.whiteText}>
                {list.likeCount}
              </ThemedText>
            </Pressable>
            <View style={styles.itemCountBadge}>
              <Ionicons name="location-outline" size={12} color="#ffffff" />
              <ThemedText type="small" style={styles.whiteText}>
                {list.itemCount}
              </ThemedText>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three * 0.8,
    padding: Spacing.three * 0.8,
    gap: Spacing.one,
    backgroundColor: '#1B2A4A',
  },
  cardTitle: {
    fontSize: 14,
    lineHeight: 19,
  },
  byline: {
    fontSize: 11,
    lineHeight: 14,
  },
  collage: {
    flexDirection: 'column',
    gap: Spacing.one,
  },
  mainPhoto: {
    width: '100%',
    height: 76,
    borderRadius: Spacing.two,
  },
  photoPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  subPhotoRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  subPhoto: {
    flex: 1,
    height: 40,
    borderRadius: Spacing.two,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.half,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  itemCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  whiteText: {
    color: '#ffffff',
  },
  whiteTextSecondary: {
    color: 'rgba(255,255,255,0.75)',
  },
});
