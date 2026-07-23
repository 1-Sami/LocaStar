import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { pickImages } from '@/lib/media-upload';
import { Spacing } from '@/constants/theme';

export function PhotoPicker({ uris, onChange }: { uris: string[]; onChange: (uris: string[]) => void }) {
  const handleAdd = async () => {
    const picked = await pickImages();
    if (picked.length > 0) onChange([...uris, ...picked]);
  };

  const handleRemove = (index: number) => {
    onChange(uris.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.row}>
      {uris.map((uri, index) => (
        <View key={`${uri}-${index}`} style={styles.slot}>
          <Image source={{ uri }} style={styles.image} contentFit="cover" />
          <Pressable style={styles.removeButton} onPress={() => handleRemove(index)} hitSlop={6}>
            <Ionicons name="close-circle" size={20} color="#E05252" />
          </Pressable>
        </View>
      ))}
      <Pressable style={styles.slot} onPress={handleAdd}>
        <View style={styles.addSlot}>
          <Ionicons name="add" size={28} color="#ffffff" />
        </View>
      </Pressable>
    </View>
  );
}

const SLOT_SIZE = '31%';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  slot: {
    width: SLOT_SIZE,
    aspectRatio: 1,
  },
  image: {
    flex: 1,
    borderRadius: Spacing.two,
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ffffff',
    borderRadius: 10,
  },
  addSlot: {
    flex: 1,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
