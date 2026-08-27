import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';

import { Colors } from '@/constants/theme';
import { useNotificationsBadge } from '@/lib/notifications-context';
import { useThemeMode } from '@/lib/theme-mode-context';

export default function AppTabs() {
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
      /*
       * iOS 26 shrinks the tab bar while you scroll, and the labels go with
       * it — on the Home screen, whose carousels are the first thing anyone
       * touches, the bar arrived already minimised and read "Sea…", "Co…",
       * "Prof…". Tapping a tab expanded it again, which is why it looked
       * like the labels were failing to render rather than being squeezed.
       * The default is 'automatic'; this is the opt-out, and it costs
       * nothing on older iOS or on Android, where the prop is ignored.
       */
      minimizeBehavior="never"
      /*
       * An explicit 10pt, because iOS 26's floating tab bar is narrower than
       * the old edge-to-edge one and the selected tab's capsule takes a bite
       * out of what is left. Measured off a 390pt iPhone 13 screenshot: the
       * four unselected tabs get about 52pt each, and the system was drawing
       * the labels at roughly 12pt, so "Search" and "Profile" arrived as
       * "Sea…" and "Prof…". 10pt is UIKit's own tab bar size, so this is
       * asking for the standard rather than shrinking below it.
       *
       * `default` covers every state; `selected` only overlays the colour on
       * top, so the size survives — see appendStyleToAppearance in
       * expo-router's appearance.ios.
       *
       * "Community" is knowingly left too long: nine characters does not fit
       * whatever the size, and the owner chose the honest word over one that
       * fits (2026-08-27). It still shows as "Co…" on iOS 26. Don't shorten
       * it without asking, and don't drop the font further to chase it.
       */
      labelStyle={{
        default: { fontSize: 10 },
        selected: { fontSize: 10, color: colors.text },
      }}>
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
