/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    primary: '#14747A',
    accent: '#E8A93B',
    // Outline for form fields. backgroundElement was being used for this and is
    // all but invisible against the page — on dark, a #1C1D21 border on a
    // #0A0A0D background reads as no border at all, so inputs looked like
    // floating text rather than boxes you could type in.
    fieldBorder: 'rgba(0,0,0,0.35)',
  },
  dark: {
    text: '#ffffff',
    background: '#0A0A0D',
    backgroundElement: '#1C1D21',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    primary: '#2BA3A3',
    accent: '#E8A93B',
    fieldBorder: 'rgba(255,255,255,0.55)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/*
 * Moved to packages/shared so the website renders the identical map — it is
 * keyed by database slug, and a second copy would drift the first time a
 * category is added. Re-exported so every existing import still works.
 */
export { CategoryColors } from '@locastar/shared';

/**
 * Fixed near-black palette for the redesigned Search screen. Deliberately not
 * theme-adaptive (light/dark) — this is a dedicated dark UI treatment per spec.
 */
export const SearchPalette = {
  background: '#0A0A0A',
  card: '#141414',
  hairline: '#202020',
  inputBorder: '#2A2A2A',
  text: '#F2F2F2',
  textMuted: '#8A8A8A',
  accent: '#E8A93B',
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80, web: 80 }) ?? 0;
export const MaxContentWidth = 800;
