import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { pickImages, takePhoto } from '@/lib/media-upload';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function PhotoPicker({ uris, onChange }: { uris: string[]; onChange: (uris: string[]) => void }) {
  const theme = useTheme();
  const [sourceMenuVisible, setSourceMenuVisible] = useState(false);

  const handleChooseFromLibrary = async () => {
    const picked = await pickImages();
    if (picked.length > 0) onChange([...uris, ...picked]);
  };

  const handleTakePhoto = async () => {
    const taken = await takePhoto();
    if (taken) onChange([...uris, taken]);
  };

  const closeMenuThen = async (action: () => Promise<void>) => {
    setSourceMenuVisible(false);
    // iOS won't present the camera/library sheet while this menu is still
    // animating out, so let that finish first.
    if (Platform.OS === 'ios') await new Promise((resolve) => setTimeout(resolve, 300));
    await action();
  };

  const handleAdd = () => {
    // Web has no reliable camera capture, so skip the menu and go to the library.
    if (Platform.OS === 'web') {
      void handleChooseFromLibrary();
      return;
    }
    setSourceMenuVisible(true);
  };

  const handleRemove = (index: number) => {
    onChange(uris.filter((_, i) => i !== index));
  };

  /**
   * Swaps a photo with its neighbour.
   *
   * Order is not cosmetic: photos are uploaded in this order and location_photos
   * ties break on created_at, so the first one becomes the cover shown on every
   * search card. Before this the only way to fix a wrong order was to remove
   * every photo and re-add them in sequence.
   */
  const move = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= uris.length) return;
    const next = [...uris];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <View style={styles.row}>
      {uris.map((uri, index) => (
        <View key={`${uri}-${index}`} style={styles.slot}>
          <Image source={{ uri }} style={styles.image} contentFit="cover" />

          {index === 0 && (
            <View style={styles.coverBadge}>
              <ThemedText type="small" style={styles.coverBadgeText}>
                COVER
              </ThemedText>
            </View>
          )}

          {uris.length > 1 && (
            <View style={styles.reorderBar}>
              <Pressable
                onPress={() => move(index, -1)}
                disabled={index === 0}
                hitSlop={6}
                style={styles.reorderButton}>
                <Ionicons name="chevron-back" size={16} color={index === 0 ? '#6B6B6B' : '#ffffff'} />
              </Pressable>
              <Pressable
                onPress={() => move(index, 1)}
                disabled={index === uris.length - 1}
                hitSlop={6}
                style={styles.reorderButton}>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={index === uris.length - 1 ? '#6B6B6B' : '#ffffff'}
                />
              </Pressable>
            </View>
          )}

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

      {uris.length > 1 && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.reorderHint}>
          The first photo is the one people see on search results — use the arrows to reorder.
        </ThemedText>
      )}

      <Modal
        visible={sourceMenuVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSourceMenuVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSourceMenuVisible(false)}>
          <ThemedView type="backgroundElement" style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              Add a photo
            </ThemedText>
            <Pressable style={styles.modalRow} onPress={() => closeMenuThen(handleTakePhoto)}>
              <Ionicons name="camera-outline" size={22} color={theme.text} />
              <ThemedText type="default">Take a photo</ThemedText>
            </Pressable>
            <Pressable style={styles.modalRow} onPress={() => closeMenuThen(handleChooseFromLibrary)}>
              <Ionicons name="images-outline" size={22} color={theme.text} />
              <ThemedText type="default">Choose from library</ThemedText>
            </Pressable>
          </ThemedView>
        </Pressable>
      </Modal>
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
  coverBadge: {
    position: 'absolute',
    top: Spacing.one,
    left: Spacing.one,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: Spacing.one,
    borderRadius: 3,
  },
  coverBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  reorderBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderBottomLeftRadius: Spacing.two,
    borderBottomRightRadius: Spacing.two,
  },
  reorderButton: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.two,
  },
  reorderHint: {
    width: '100%',
  },
  addSlot: {
    flex: 1,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
  },
  modalTitle: {
    fontSize: 20,
    lineHeight: 26,
    marginBottom: Spacing.two,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
});
