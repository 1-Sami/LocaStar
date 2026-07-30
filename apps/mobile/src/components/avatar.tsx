import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

/**
 * A person's picture, or a neutral placeholder when they haven't set one.
 *
 * The placeholder is deliberately a plain silhouette: avatars used to fall back
 * to a random stock photo, which read as if the person had chosen it.
 */
export function Avatar({ url, size }: { url: string | null | undefined; size: number }) {
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (!url) {
    return (
      <View style={[styles.placeholder, shape]}>
        <Ionicons name="person" size={size * 0.55} color="rgba(255,255,255,0.5)" />
      </View>
    );
  }

  return <Image source={{ uri: url }} style={shape} contentFit="cover" />;
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3A3D42',
  },
});
