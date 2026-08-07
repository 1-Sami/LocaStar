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

/**
 * Fixed brand colors for location category cards — same in light and dark mode.
 *
 * Keys are category *slugs* from the `categories` table, not display names.
 * Hue carries the family, so a glance says roughly what kind of place it is:
 * blue = water, green = nature and trails, warm = sport, purple = built or
 * cultural. Shades stay dark and muted because these are used both as a card
 * border and as a badge background with white text on top.
 */
export const CategoryColors: Record<string, string> = {
  // Water & coast
  swimming: '#163A4A',
  'water-activities': '#0F4C5C',
  beaches: '#1C6E7A',
  'diving-spots': '#0E3F52',
  fishing: '#2A5B6B',

  // Winter
  skiing: '#1B2A4A',
  'ice-skating': '#3A5B8C',

  // Ball sports
  football: '#1F5C33',
  basketball: '#7A3B12',
  baseball: '#5C1F1F',
  cricket: '#5C4B1F',
  golf: '#4C5A26',
  'amerikan-fotball': '#6B2E1A',
  volleyball: '#8A5A1E',
  tennis: '#7A6B14',
  boule: '#6B5A3A',
  'mini-golf': '#3F6B2E',
  'disc-golf-frisbee': '#4A6B33',

  // Wheels & motor
  roads: '#4A4A52',
  bmx: '#6B7A2E',
  skatepark: '#4A3F5C',
  'motocross-atv-tracks': '#5C3A1E',
  'race-tracks-vehicle': '#3A3F4A',
  'rc-race-track': '#4A5568',
  'horse-track': '#6B4A2E',

  // Nature & trails
  'bike-trails': '#2E4A1F',
  hiking: '#2A5C3F',
  'jogging-trails': '#386B4A',
  'nature-reserves': '#1F4A2E',
  birdwatching: '#4A6B52',
  camping: '#33502E',
  outdoor: '#3F5C33',
  'scenic-place': '#2E5C52',

  // Parks & family
  'picknick-parks': '#4A5C2E',
  'dog-parks': '#5C4A2E',
  playgrounds: '#7A3B5C',
  'grill-sites': '#6B3A2E',
  'action-parks': '#8A4A2E',
  '4h-farms': '#5C5C2E',

  // Challenge & training
  'gyms-outside': '#6B3F1D',
  climbing: '#5C3F2E',
  parkour: '#4A3A5C',
  'obstacle-course': '#5C2E4A',
  'archery-ranges': '#4A5C5C',
  'shooting-range': '#3F4A52',
  paintball: '#6B2E4A',
  'track-and-field-stadium': '#8A5A2E',

  // Indoor
  bowling: '#4A2E5C',

  // Culture & other
  festival: '#5C1B3A',
  'historical-ruins-places': '#5C4A5C',
  'public-art': '#6B3A6B',
  library: '#3A4A6B',
  'museums-free': '#5C3A6B',

  // "Others" is the catch-all, so reading as unclassified is correct.
  other: '#33363B',
  default: '#33363B',
};

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
