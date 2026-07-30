import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { CategoryColors, Spacing } from '@/constants/theme';

export function CategoryChip({
  label,
  categorySlug,
  onRemove,
}: {
  label: string;
  categorySlug: string;
  onRemove: () => void;
}) {
  const color = CategoryColors[categorySlug] ?? CategoryColors.default;

  return (
    <Pressable onPress={onRemove} style={[styles.chip, { borderColor: color }]}>
      <ThemedText type="smallBold" style={styles.label}>
        ×
      </ThemedText>
      <ThemedText type="small" style={styles.label} numberOfLines={1}>
        {label.toUpperCase()}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    // Fixed height (not padding-driven) so the pill's size can't depend on
    // font-metric measurement — that's what was causing the chip to flash
    // at the wrong size for a frame, and clip descenders on some labels.
    height: 34,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  label: {
    color: '#ffffff',
    letterSpacing: 0.3,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
