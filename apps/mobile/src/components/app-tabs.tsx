import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useNotificationsBadge } from '@/lib/notifications-context';
import { useThemeMode } from '@/lib/theme-mode-context';

/** See the block in AppTabs. The figure is the one react-navigation#12908 reports as reliable. */
const NATIVE_TABS_MOUNT_DELAY_MS = 1000;

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

  /*
   * Hold the tab bar back for a moment on iOS, because mounting it too early
   * lays it out wrong and nothing after that puts it right.
   *
   * This is an upstream bug, not ours: react-navigation#12908, "[iOS 26+]
   * Native Bottom Tab Navigator labels truncated with ellipsis and
   * mispositioned". Both halves of that title are what you see — the labels
   * arrive as "Sea…", "Co…", "Prof…" *and* sit lower than they should, and
   * both correct themselves the instant any tab is tapped. Nothing in this
   * file causes it, which is why chasing it through font size, label
   * wording, minimizeBehavior and backgroundColor all missed: the layout is
   * simply computed before iOS 26 can measure the bar, and the first touch
   * forces the re-measure that should have happened on its own.
   *
   * The delay is the workaround the issue documents, at the duration it
   * gives. It is deliberately generous — the failure it prevents is visible
   * on every launch, while the cost is hidden behind the splash overlay,
   * which is still on screen for most of it.
   *
   * iOS only: Android has no Liquid Glass tab bar and no such bug, so it
   * starts ready and pays nothing. Delete this the day the fix lands
   * upstream — check the issue before assuming it is still needed.
   */
  const [tabsReady, setTabsReady] = useState(Platform.OS !== 'ios');
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const timer = setTimeout(() => setTabsReady(true), NATIVE_TABS_MOUNT_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // Matches the app background rather than the splash's teal, so the splash
  // fades into the app's own colour instead of appearing to linger.
  if (!tabsReady) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    // "labeled" keeps every label on screen. The default is "auto", which on
    // Android hides the label of every tab except the selected one — so four of
    // the five became bare icons, and an icon alone does not say "Community" or
    // "Saved" to someone opening the app for the first time. iOS labels all tabs
    // regardless, so this also makes the two platforms agree.
    <NativeTabs
      /*
       * iOS deliberately gets no colour here, and that is the whole fix for
       * the truncated labels.
       *
       * expo-router builds *two* appearances for the bar. The scroll-edge one
       * discards our colour and asks for the system's own glass — literally
       * `backgroundColor: null, blurEffect: 'none'` in
       * createScrollEdgeAppearanceFromOptions — while the standard one uses
       * whatever is passed here. So the bar had two different looks, which is
       * the light-to-dark flip visible between a fresh launch and a few taps
       * later. The labels track it exactly: whole in the system appearance,
       * cut to "Sea…" / "Co…" / "Prof…" in ours. Handing iOS 26's Liquid
       * Glass bar an opaque colour is what makes it lay the items out short,
       * so we stop handing it one and let it pick — which it already does
       * correctly whenever the page sits at the scroll edge.
       *
       * Android keeps the colour. It has no Liquid Glass, no scroll-edge
       * appearance and no such bug, and without this its bar falls back to
       * the Material default instead of the app's own background.
       */
      backgroundColor={Platform.OS === 'ios' ? undefined : colors.background}
      indicatorColor={colors.backgroundElement}
      labelVisibilityMode="labeled"
      /*
       * Stops iOS 26 shrinking the bar as the page scrolls. Kept for its own
       * sake — a bar that collapses under a carousel is worse than one that
       * doesn't — but note it was never the cause of the truncated labels,
       * which is what it was first added to chase. The default is 'automatic';
       * this is the opt-out, and it is ignored on older iOS and on Android.
       */
      minimizeBehavior="never"
      /*
       * Both states named explicitly, for both icons and labels.
       *
       * Only the selected label had a colour before, so everything else took
       * whatever the system chose. On iOS that is a light grey picked for
       * Apple's own translucent bar, and against a light background it came
       * out barely visible — reported on an S10, an iPhone 13 and a Flip 3.
       * Naming all four states keeps the bar legible on either theme instead
       * of depending on what the platform happens to default to.
       */
      iconColor={{ default: colors.textSecondary, selected: colors.primary }}
      labelStyle={{
        default: { color: colors.textSecondary },
        selected: { color: colors.text },
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
