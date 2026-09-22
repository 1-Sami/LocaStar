import type { TFunction } from 'i18next';

import { CATEGORY_NAMES } from '@locastar/shared';

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
/*
 * Keyed on the database row's English name, so a rename has to happen in both
 * places at once — here in CATEGORY_NAMES and on the `categories` row — or the
 * screens that have only `category_label` lose the slug and show the old word.
 * 0140 is an example: "Picnic parks" became "Parks" in both.
 */
const SLUG_BY_ENGLISH_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_NAMES.en).map(([slug, name]) => [name, slug])
);

export function categoryLabelFromName(t: TFunction, name: string): string {
  const slug = SLUG_BY_ENGLISH_NAME[name];
  return slug ? t(`categories.${slug}`, { defaultValue: name }) : name;
}
