import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export function SectionBadge({
  label,
  backgroundColor,
  textColor = '#ffffff',
}: {
  label: string;
  backgroundColor: string;
  textColor?: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <ThemedText type="smallBold" style={{ color: textColor }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.five,
  },
});
