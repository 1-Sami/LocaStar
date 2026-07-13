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
    <Pressable onPress={onRemove} style={[styles.chip, { backgroundColor: color }]}>
      <ThemedText type="small" style={styles.label}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold" style={styles.label}>
        ×
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
    paddingVertical: Spacing.one,
    borderRadius: Spacing.five,
  },
  label: {
    color: '#ffffff',
  },
});
