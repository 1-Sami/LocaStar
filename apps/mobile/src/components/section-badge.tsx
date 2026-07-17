import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export function SectionBadge({
  label,
  count,
  backgroundColor,
  textColor = '#ffffff',
}: {
  label: string;
  count?: number;
  backgroundColor: string;
  textColor?: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <ThemedText type="smallBold" style={{ color: textColor }}>
        {label}
      </ThemedText>
      {count !== undefined && (
        <ThemedText type="smallBold" style={{ color: textColor }}>
          {count}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.five,
  },
});
