import { SearchPalettes, type SearchPaletteColors } from '@/constants/theme';
import { useThemeMode } from '@/lib/theme-mode-context';

/**
 * The search screen's palette for the theme in force.
 *
 * Its styles are built from this rather than read at module scope, so the
 * screen repaints when the theme changes instead of staying on whichever one
 * happened to be current when the module first loaded.
 */
export function useSearchPalette(): SearchPaletteColors {
  const { resolvedScheme } = useThemeMode();
  return SearchPalettes[resolvedScheme];
}
