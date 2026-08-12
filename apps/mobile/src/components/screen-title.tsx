import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MENU_ICONS, type MenuId } from '@/constants/menu-icons';
import { Spacing } from '@/constants/theme';

/**
 * A screen header that matches the Profile row you tapped to get here.
 *
 * The plain white stack title said nothing about where you had landed, and Add
 * location solved that by repeating itself: a coloured heading inside the
 * content, directly under a header saying the same words. This puts the icon
 * and colour in the header where the title already was, and the duplicate goes.
 *
 * Takes the destination's id and does its own lookup and translation. It used
 * to take the finished label and look the icon up by that, which quietly failed
 * in every language but English — see the note in menu-icons.
 *
 * Label comes from `menu.<id>`, the same string the Profile row uses, so the
 * header and the row you tapped cannot say different things.
 *
 * Pass it as `headerTitle`, not `title` — `title` only takes a string.
 */
export function ScreenTitle({ titleKey }: { titleKey: MenuId }) {
  const { t } = useTranslation();
  const config = MENU_ICONS[titleKey];

  return (
    <View style={styles.row}>
      {config.family === 'material' ? (
        <MaterialCommunityIcons name={config.icon} size={20} color={config.color} />
      ) : (
        <Ionicons name={config.icon} size={20} color={config.color} />
      )}
      <ThemedText type="subtitle" style={[styles.title, { color: config.color }]}>
        {t(`menu.${titleKey}`)}
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
