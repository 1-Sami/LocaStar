import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { useNotificationsBadge } from '@/lib/notifications-context';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const { unreadCount } = useNotificationsBadge();

  return (
    // "labeled" keeps every label on screen. The default is "auto", which on
    // Android hides the label of every tab except the selected one — so four of
    // the five became bare icons, and an icon alone does not say "Community" or
    // "Saved" to someone opening the app for the first time. iOS labels all tabs
    // regardless, so this also makes the two platforms agree.
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelVisibilityMode="labeled"
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search">
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>

      {/* Middle slot on purpose: adding a place is the action the whole app
          depends on, and it was previously three taps deep in the Profile menu. */}
      <NativeTabs.Trigger name="add">
        <NativeTabs.Trigger.Label>Add</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'plus.circle', selected: 'plus.circle.fill' }}
          md="add_circle_outline"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="community">
        <NativeTabs.Trigger.Label>Community</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.3', selected: 'person.3.fill' }} md="groups" />
      </NativeTabs.Trigger>

      {/*
        Saved is deliberately not here. iOS shows at most five tabs and pushes
        the rest into a "More" list, so something had to give up its slot for
        Add — and Saved is the one already reached in a tap from the Favorites,
        Saved for later and Shared tiles on Home and Profile.

        It lives at app/favorites.tsx, a pushed screen, NOT a hidden tab. A
        hidden tab is filtered out of the navigator, and in production
        NativeTabsView does not error on that — it silently falls back to tab
        index 0, so every one of those tiles quietly landed you on Home.
      */}

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
          md="person"
        />
        {unreadCount > 0 && (
          <NativeTabs.Trigger.Badge>{unreadCount > 9 ? '9+' : String(unreadCount)}</NativeTabs.Trigger.Badge>
        )}
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
