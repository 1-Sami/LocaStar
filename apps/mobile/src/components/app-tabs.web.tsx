import { Ionicons } from '@expo/vector-icons';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, View, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNotificationsBadge } from '@/lib/notifications-context';

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; href: string; label: string; icon: IconName; iconActive: IconName }[] = [
  // expo-router's typed-routes generation for grouped index routes doesn't
  // include the bare "/" it actually resolves to at runtime.
  { name: 'home', href: '/' as never, label: 'Home', icon: 'home-outline', iconActive: 'home' },
  { name: 'search', href: '/search', label: 'Search', icon: 'search-outline', iconActive: 'search' },
  {
    name: 'community',
    href: '/community',
    label: 'Community',
    icon: 'people-outline',
    iconActive: 'people',
  },
  {
    name: 'favorites',
    href: '/favorites',
    label: 'Saved',
    icon: 'bookmark-outline',
    iconActive: 'bookmark',
  },
  {
    name: 'profile',
    href: '/profile',
    label: 'Profile',
    icon: 'person-circle-outline',
    iconActive: 'person-circle',
  },
];

export default function AppTabs() {
  const { unreadCount } = useNotificationsBadge();
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href as never} asChild>
              <TabButton icon={tab.icon} iconActive={tab.iconActive} showBadge={tab.name === 'profile' && unreadCount > 0}>
                {tab.label}
              </TabButton>
            </TabTrigger>
          ))}
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({
  children,
  isFocused,
  icon,
  iconActive,
  showBadge,
  ...props
}: TabTriggerSlotProps & { icon: IconName; iconActive: IconName; showBadge?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <View style={styles.tabButtonView}>
        <View>
          <Ionicons
            name={isFocused ? iconActive : icon}
            size={22}
            color={isFocused ? theme.primary : theme.textSecondary}
          />
          {showBadge && <View style={styles.badgeDot} />}
        </View>
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  badgeDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E05252',
  },
});
