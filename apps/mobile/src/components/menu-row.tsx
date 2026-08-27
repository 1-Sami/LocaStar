import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MENU_ICONS, type MenuId } from '@/constants/menu-icons';
import { Spacing } from '@/constants/theme';

/*
 * The menu rows' width, frozen as the number it has always evaluated to.
 *
 * It used to be written as (91 * 3 + STAT_TILE_GAP * 2) * 0.8 on the Profile
 * screen, which tied the menu to the spacing between the stat tiles for no
 * reason beyond the two having once been designed together — narrowing that
 * gap quietly narrowed every row below it. Shared here so every screen of
 * rows (Profile, Admin) lines up at the same width without re-deriving it.
 */
export const MENU_ROW_WIDTH = 234.4;

export function MenuRow({
  item,
  badgeCount,
  onPress,
}: {
  item: MenuId;
  badgeCount?: number;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const iconConfig = MENU_ICONS[item];
  return (
    <Pressable onPress={onPress}>
      <ThemedView type="backgroundElement" style={styles.menuItem}>
        <View style={styles.menuItemLeft}>
          <View style={[styles.menuIcon, { backgroundColor: `${iconConfig.color}33` }]}>
            {iconConfig.family === 'material' ? (
              <MaterialCommunityIcons name={iconConfig.icon} size={17} color={iconConfig.color} />
            ) : (
              <Ionicons name={iconConfig.icon} size={17} color={iconConfig.color} />
            )}
          </View>
          <ThemedText type="default" style={styles.menuItemText}>
            {t(`menu.${item}`)}
          </ThemedText>
          {badgeCount !== undefined && badgeCount > 0 && (
            <View style={styles.reportsBadge}>
              <ThemedText type="small" style={styles.reportsBadgeText}>
                {badgeCount}
              </ThemedText>
            </View>
          )}
        </View>
        <ThemedText themeColor="textSecondary" style={styles.menuChevron}>
          ›
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: Spacing.two,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuItemText: {
    fontSize: 19,
    lineHeight: 26,
  },
  reportsBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: '#E05252',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportsBadgeText: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  menuChevron: {
    fontSize: 19,
  },
  menuIcon: {
    width: 29,
    height: 29,
    borderRadius: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
