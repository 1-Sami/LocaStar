import AsyncStorage from '@react-native-async-storage/async-storage';
// Named imports rather than methods off the default instance: i18next exports
// both, and reaching through the default is what the import/no-named-as-default
// -member rule objects to. These act on the same singleton.
//
// `use` is aliased because React 19 has a hook of that name, and the
// rules-of-hooks lint reads a bare top-level `use(...)` as calling it.
import i18next, { changeLanguage, init, use as registerPlugin } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Platform } from 'react-native';

import en from '@/locales/en.json';
import sv from '@/locales/sv.json';

export const LANGUAGES = ['en', 'sv'] as const;
export type Language = (typeof LANGUAGES)[number];

/** 'system' follows the phone; the other two override it. */
export type LanguagePreference = Language | 'system';

const STORAGE_KEY = 'locastar.language';

/**
 * The phone's language, without expo-localization.
 *
 * expo-localization is the obvious way to read this and is deliberately not
 * used: it is a *native* module, and adding one to the JS bundle that the
 * installed app does not contain crashes it on launch — which then blocks every
 * further over-the-air update until everyone reinstalls. Localisation is
 * otherwise pure JavaScript, so paying that price for one string would be a bad
 * trade.
 *
 * Intl is built into Hermes and gives the same answer. Wrapped in a try because
 * a runtime without full ICU throws here rather than returning something
 * useless, and English is the right thing to fall back to.
 */
export function deviceLanguage(): Language {
  /*
   * During the static web export there is no device, and Intl answers with the
   * locale of the machine running the build. locastar.se went out in Swedish
   * for that reason alone — the laptop that exported it is Swedish — while the
   * generated markup still said <html lang="en">. Swedish text declared as
   * English is wrong for a screen reader and for a crawler, and it would have
   * silently changed language the first time somebody built it elsewhere.
   *
   * Pinning the prerender to English makes the served HTML match that
   * attribute; the browser re-runs this on hydration and a Swedish visitor
   * gets Swedish. Narrow on purpose — Platform.OS is 'ios' or 'android' on a
   * phone, so this branch cannot affect the app.
   */
  if (Platform.OS === 'web' && typeof window === 'undefined') return 'en';

  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale;
    return tag?.toLowerCase().startsWith('sv') ? 'sv' : 'en';
  } catch {
    return 'en';
  }
}

/*
 * Initialised synchronously, with the device language, before the first render.
 *
 * The stored override is read afterwards because AsyncStorage is async and
 * blocking the first paint on it would mean a blank frame on every cold start.
 * The cost is that someone who has overridden the language sees one frame of
 * the device language first; loadStoredLanguage() below closes that as early as
 * it can.
 */
registerPlugin(initReactI18next);
init({
  resources: {
    en: { translation: en },
    sv: { translation: sv },
  },
  lng: deviceLanguage(),
  fallbackLng: 'en',
  // A missing Swedish key falls through to English rather than rendering the
  // key itself. A half-translated screen is survivable; "settings.title" is not.
  interpolation: { escapeValue: false },
  // React Native already escapes; and returning null for a missing key fights
  // TypeScript for no benefit.
  returnNull: false,
});

/** Applies the saved override, if there is one. Called once at startup. */
export async function loadStoredLanguage(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if ((stored === 'en' || stored === 'sv') && i18next.language !== stored) {
      await changeLanguage(stored);
    }
  } catch {
    // Storage unavailable — the device language is a fine answer.
  }
}

export async function getLanguagePreference(): Promise<LanguagePreference> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return stored === 'en' || stored === 'sv' ? stored : 'system';
  } catch {
    return 'system';
  }
}

/**
 * Stores the choice and switches immediately.
 *
 * Kept in AsyncStorage rather than on the profile, which is where the theme
 * preference lives. Language has to work for someone who is not signed in —
 * the sign-in screen itself needs translating — and the theme's pattern resets
 * to 'system' on sign-out, which would be wrong here.
 */
export async function setLanguagePreference(preference: LanguagePreference): Promise<void> {
  const next = preference === 'system' ? deviceLanguage() : preference;
  await changeLanguage(next);
  try {
    if (preference === 'system') await AsyncStorage.removeItem(STORAGE_KEY);
    else await AsyncStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // The switch already happened; it just will not survive a restart.
  }
}
