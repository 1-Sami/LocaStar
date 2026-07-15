/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useThemeMode } from '@/lib/theme-mode-context';

export function useTheme() {
  const { resolvedScheme } = useThemeMode();
  return Colors[resolvedScheme];
}
