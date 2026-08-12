import type { TFunction } from 'i18next';

import en from '@/locales/en.json';

/**
 * Category names come from the database, so they were never in the catalogue
 * and stayed English in every language — the filter sheet, the picker on the
 * add form, the chip on a location.
 *
 * They are translated by slug rather than by adding a `name_sv` column: the
 * slug is stable and the name is not, no migration is needed, and a category
 * added later simply shows its database name until someone writes a
 * translation for it.
 */
export function categoryLabel(t: TFunction, slug: string, fallback: string): string {
  return t(`categories.${slug}`, { defaultValue: fallback });
}

/**
 * The same, for the three places that only have a name to go on:
 * `nearby_locations` returns `category_label`, not a slug.
 *
 * The lookup is built by inverting the English catalogue rather than being
 * written out again, so there is exactly one list of English category names in
 * the repo. A name the map does not know — because someone renamed it in the
 * database — falls through to the name itself, which is what was shown before.
 */
const SLUG_BY_ENGLISH_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(en.categories as Record<string, string>).map(([slug, name]) => [name, slug])
);

export function categoryLabelFromName(t: TFunction, name: string): string {
  const slug = SLUG_BY_ENGLISH_NAME[name];
  return slug ? t(`categories.${slug}`, { defaultValue: name }) : name;
}
