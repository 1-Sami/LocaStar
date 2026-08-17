import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export type MenuIcon =
  | { icon: keyof typeof Ionicons.glyphMap; family?: 'ionicons'; color: string }
  | { icon: keyof typeof MaterialCommunityIcons.glyphMap; family: 'material'; color: string };

/**
 * Every destination reachable from the Profile screen, as a stable id.
 *
 * The id is the join between three things that must agree: the icon below, the
 * menu row's label (`menu.<id>`) and the screen header's title (`nav.<id>`).
 * Two of those are translated and the id is not, which is the point.
 */
export type MenuId =
  | 'myLists'
  | 'friends'
  | 'addLocation'
  | 'addActivity'
  | 'settings'
  | 'about'
  | 'reports'
  | 'peopleAndBans'
  | 'moderationLog'
  | 'crashes'
  | 'myReviews'
  | 'myContributions'
  | 'saved'
  | 'notifications';

/**
 * The icon and colour for each destination reached from the Profile screen.
 *
 * One map, used twice: by the rows in the Profile menu, and by ScreenTitle in
 * the header of the screen each row opens. A screen whose header says something
 * the menu row didn't reads as a different place than the one you tapped.
 *
 * Keyed by id rather than by the label it used to be. Keying on the label
 * worked right up until the labels were translated, and then broke in a way
 * only a Swedish speaker would ever see: MENU_ICONS['Sparat'] is undefined, so
 * the header quietly lost its icon and its colour while English kept both. The
 * English build could not have caught it — there the translation and the old
 * key are the same string.
 *
 * Includes destinations with no menu row of their own (My reviews, Saved,
 * Notifications), which are reached from the stat tiles instead.
 */
export const MENU_ICONS: Record<MenuId, MenuIcon> = {
  myLists: { icon: 'folder-marker-outline', family: 'material', color: '#4C8FE8' },
  friends: { icon: 'people-outline', color: '#F5738A' },
  addLocation: { icon: 'add-circle-outline', color: '#C34CE8' },
  addActivity: { icon: 'time-outline', color: '#E8A93B' },
  settings: { icon: 'settings-outline', color: '#B0B4BA' },
  about: { icon: 'information-circle-outline', color: '#14747A' },
  reports: { icon: 'flag-outline', color: '#E05252' },
  peopleAndBans: { icon: 'shield-checkmark-outline', color: '#E8A93B' },
  moderationLog: { icon: 'document-text-outline', color: '#4C8FE8' },
  crashes: { icon: 'bug-outline', color: '#E05252' },
  myReviews: { icon: 'create-outline', color: '#4CD37A' },
  myContributions: { icon: 'location-outline', color: '#C34CE8' },
  saved: { icon: 'bookmark-outline', color: '#4C8FE8' },
  notifications: { icon: 'notifications-outline', color: '#E8A93B' },
};
