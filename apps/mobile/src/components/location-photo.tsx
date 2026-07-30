import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

/**
 * A location's cover photo, or a neutral placeholder when it has none.
 *
 * Cards previously showed a random stock photo for every location, so a place
 * with no picture looked like it had one, and a place *with* a picture never
 * showed it. An honest placeholder is better than a borrowed landscape.
 */
export function LocationPhoto({
  url,
  style,
  iconSize = 22,
}: {
  url: string | null;
  style?: object;
  iconSize?: number;
}) {
  if (!url) {
    return (
      <View style={[styles.placeholder, style]}>
        <Ionicons name="image-outline" size={iconSize} color="rgba(255,255,255,0.35)" />
      </View>
    );
  }
  return <Image source={{ uri: url }} style={style} contentFit="cover" />;
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#26282C',
  },
});
