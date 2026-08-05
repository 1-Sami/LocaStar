import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export type MenuIcon =
  | { icon: keyof typeof Ionicons.glyphMap; family?: 'ionicons'; color: string }
  | { icon: keyof typeof MaterialCommunityIcons.glyphMap; family: 'material'; color: string };

/**
 * The icon and colour for each destination reached from the Profile screen.
 *
 * One map, used twice: by the rows in the Profile menu, and by ScreenTitle in
 * the header of the screen each row opens. Keyed by the label so the two cannot
 * drift — a screen whose header says something the menu row doesn't reads as a
 * different place than the one you tapped.
 *
 * Includes destinations that have no menu row of their own (My reviews, Saved,
 * Notifications), which are reached from the stat tiles instead.
 */
export const MENU_ICONS: Record<string, MenuIcon> = {
  'My lists': { icon: 'folder-marker-outline', family: 'material', color: '#4C8FE8' },
  Friends: { icon: 'people-outline', color: '#F5738A' },
  'Add location': { icon: 'add-circle-outline', color: '#C34CE8' },
  'Add activity': { icon: 'time-outline', color: '#E8A93B' },
  Settings: { icon: 'settings-outline', color: '#B0B4BA' },
  About: { icon: 'information-circle-outline', color: '#14747A' },
  Reports: { icon: 'flag-outline', color: '#E05252' },
  'People & bans': { icon: 'shield-checkmark-outline', color: '#E8A93B' },
  'Moderation log': { icon: 'document-text-outline', color: '#4C8FE8' },
  'My reviews': { icon: 'create-outline', color: '#4CD37A' },
  'My contributions': { icon: 'location-outline', color: '#C34CE8' },
  Saved: { icon: 'bookmark-outline', color: '#4C8FE8' },
  Notifications: { icon: 'notifications-outline', color: '#E8A93B' },
};
