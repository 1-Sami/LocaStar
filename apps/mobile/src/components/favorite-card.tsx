import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { openDirections } from '@/lib/directions';
import type { CardLocation } from '@/types/location';

export function FavoriteCard({
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
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.imageWrapper}>
        <Image source={{ uri: location.imageUrl }} style={styles.image} contentFit="cover" />
        <View style={styles.iconRow}>
          <Pressable style={styles.iconButton} onPress={onToggleFavorite} hitSlop={8}>
            <ThemedText style={isFavorite ? styles.iconActiveFavorite : styles.iconInactive}>
              {isFavorite ? '♥' : '♡'}
            </ThemedText>
          </Pressable>
          <Pressable style={styles.iconButton} onPress={onToggleBucketList} hitSlop={8}>
            <ThemedText style={isBucketListed ? styles.iconActiveBucket : styles.iconInactive}>
              {isBucketListed ? '★' : '☆'}
            </ThemedText>
          </Pressable>
        </View>
      </View>
      <View style={styles.nameRow}>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
          {location.name}
        </ThemedText>
        <Pressable onPress={() => openDirections(location.address ?? location.name)} hitSlop={4}>
          <ThemedText type="small" themeColor="textSecondary">
            Directions
          </ThemedText>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    marginBottom: Spacing.three,
  },
  imageWrapper: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 110,
    borderRadius: Spacing.two,
  },
  iconRow: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one,
    flexDirection: 'row',
    gap: Spacing.half,
  },
  iconButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInactive: {
    color: '#ffffff',
    fontSize: 15,
  },
  iconActiveFavorite: {
    color: '#4CD37A',
    fontSize: 15,
  },
  iconActiveBucket: {
    color: '#F5C242',
    fontSize: 15,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  name: {
    flexShrink: 1,
  },
});
