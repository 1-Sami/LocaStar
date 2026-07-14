import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

export const STAR_COLOR = '#E8A93B';

export function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((position) => {
        const diff = rating - position + 1;
        const name = diff >= 1 ? 'star' : diff >= 0.5 ? 'star-half' : 'star-outline';
        return <Ionicons key={position} name={name} size={size} color={STAR_COLOR} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  starRow: {
    flexDirection: 'row',
    gap: 1,
  },
});
