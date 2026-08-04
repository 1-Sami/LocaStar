import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MENU_ICONS } from '@/constants/menu-icons';
import { Spacing } from '@/constants/theme';

/**
 * A screen header that matches the Profile row you tapped to get here.
 *
 * The plain white stack title said nothing about where you had landed, and Add
 * location solved that by repeating itself: a coloured heading inside the
 * content, directly under a header saying the same words. This puts the icon
 * and colour in the header where the title already was, and the duplicate goes.
 *
 * Pass it as `headerTitle`, not `title` — `title` only takes a string.
 */
export function ScreenTitle({ label }: { label: string }) {
  const config = MENU_ICONS[label];

  return (
    <View style={styles.row}>
      {config &&
        (config.family === 'material' ? (
          <MaterialCommunityIcons name={config.icon} size={20} color={config.color} />
        ) : (
          <Ionicons name={config.icon} size={20} color={config.color} />
        ))}
      <ThemedText type="subtitle" style={[styles.title, config ? { color: config.color } : null]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    textDecorationLine: 'underline',
  },
});
