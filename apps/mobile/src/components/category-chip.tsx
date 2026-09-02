import { useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { CategoryColors, Spacing, type SearchPaletteColors } from '@/constants/theme';
import { useSearchPalette } from '@/hooks/use-search-palette';

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
  const palette = useSearchPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);

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

const createStyles = (c: SearchPaletteColors) =>
  StyleSheet.create({
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
      /*
       * The card colour, not a black wash. rgba(0,0,0,0.35) was fine on the
       * near-black screen and became a grey slab once Search followed the
       * light theme — white label on it measured about 2.3:1.
       */
      backgroundColor: c.card,
    },
    label: {
      color: c.text,
      letterSpacing: 0.3,
      includeFontPadding: false,
      textAlignVertical: 'center',
    },
  });
