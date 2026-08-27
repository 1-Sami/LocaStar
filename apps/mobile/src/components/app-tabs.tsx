import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Colors } from '@/constants/theme';
import { useNotificationsBadge } from '@/lib/notifications-context';
import { useThemeMode } from '@/lib/theme-mode-context';

export default function AppTabs() {
  /*
   * unstable-native-tabs is exactly that — unstable. On iOS the tab bar's
   * first commit sometimes reaches the OS with icons but no label text; the
   * labels only appear once something forces a second commit, which is why
   * tapping a tab "fixes" it. Forcing that second commit ourselves, once,
   * right after mount, means nobody has to tap a tab first to see labels.
   */
  const [, forceRelabel] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => forceRelabel((n) => n + 1));
    return () => cancelAnimationFrame(id);
  }, []);

  /*
   * useColorScheme() reads the OS setting directly, but the app has its own
   * light/dark override in Settings that can disagree with it. The two only
   * matched when nobody had touched that setting, which is why the tab bar
   * flashed between the wrong colour and the right one on some presses —
   * every re-render (the badge count, most navigation) reread the OS value
   * and briefly disagreed with the rest of the app, which is themed from
   * resolvedScheme. Same source everywhere fixes the mismatch, not just hides
   * a symptom of it.
   */
  const { resolvedScheme } = useThemeMode();
  const colors = Colors[resolvedScheme];
  const { unreadCount } = useNotificationsBadge();
  const { t } = useTranslation();

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
        <NativeTabs.Trigger.Label>{t('tabs.home')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search">
        <NativeTabs.Trigger.Label>{t('tabs.search')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>

      {/* Middle slot on purpose: adding a place is the action the whole app
          depends on, and it was previously three taps deep in the Profile menu. */}
      <NativeTabs.Trigger name="add">
        <NativeTabs.Trigger.Label>{t('tabs.add')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'plus.circle', selected: 'plus.circle.fill' }}
          md="add_circle_outline"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="community">
        <NativeTabs.Trigger.Label>{t('tabs.community')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.3', selected: 'person.3.fill' }} md="groups" />
      </NativeTabs.Trigger>

      {/*
        Saved is deliberately not here. iOS shows at most five tabs and pushes
        the rest into a "More" list, so something had to give up its slot for
        Add — and Saved is the one already reached in a tap from the Favorites,
        Bookmark and Shared tiles on Home and Profile.

        It lives at app/favorites.tsx, a pushed screen, NOT a hidden tab. A
        hidden tab is filtered out of the navigator, and in production
        NativeTabsView does not error on that — it silently falls back to tab
        index 0, so every one of those tiles quietly landed you on Home.
      */}

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>{t('tabs.profile')}</NativeTabs.Trigger.Label>
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
