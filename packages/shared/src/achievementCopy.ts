/*
 * Every word the achievements system says, in both languages.
 *
 * It lives here for the same reason categoryNames.ts and about.ts do: two
 * frontends render it. The app's Achievements screen and the badge beside a
 * review need these names, and so does the website's account area — and the
 * owner has already renamed one badge once ("Gap filler" became "Pioneer" the
 * day after it was drawn). A second copy is a copy that drifts, and a badge
 * called one thing on a phone and another on the site is worse than either.
 *
 * The app merges this into its i18next resources under `achievements`, so every
 * existing t('achievements.<key>') call keeps working unchanged.
 */

import type { BadgeGroup, BadgeId, LevelId, ScoreLineId } from "./achievements";

export interface AchievementCopy {
  levelOf: string;
  points: string;
  toNext: string;
  atTheTop: string;
  closest: string;
  earnedOf: string;
  bonus: string;
  howPoints: string;
  fromBadges: string;
  footnote: string;
  loadFailed: string;
  signedOut: string;
  notForThisAccount: string;
  title: string;
  group: Record<BadgeGroup, string>;
  level: Record<LevelId, string>;
  line: Record<ScoreLineId, string>;
  badge: Record<BadgeId, { name: string; need: string }>;
}

export const ACHIEVEMENT_COPY: Record<"en" | "sv", AchievementCopy> = {
  en: {
    title: "Achievements",
    levelOf: "Level {{number}} of {{total}}",
    points: "points",
    toNext: "{{points}} to {{level}}",
    atTheTop: "You have reached the top level. Everything from here is for the map, not for the number.",
    closest: "Closest to done",
    earnedOf: "{{earned}} of {{total}} earned",
    bonus: "+{{points}}",
    howPoints: "How points work",
    fromBadges: "Badges earned",
    footnote:
      "Points come from what is still on the map — anything a moderator removes takes its points with it. Nothing here is compared to anybody else.",
    loadFailed: "Could not load your achievements just now. Go back and try again.",
    signedOut: "Log in to see what you have collected.",
    notForThisAccount:
      "Achievements are for the people contributing to the map, so partner and admin accounts do not collect them.",
    group: {
      coverage: "Coverage — what the map lacks",
      range: "Range — where you have been",
      habit: "Habit — sticking with it",
    },
    level: {
      newcomer: "Newcomer",
      contributor: "Contributor",
      regular: "Regular",
      localExpert: "Local expert",
      guide: "Guide",
      seniorGuide: "Senior guide",
      mapmaker: "Mapmaker",
      legend: "Legend",
    },
    line: {
      placesAdded: "Places added",
      firstPhotos: "First photo of a place",
      eventsAdded: "Events added",
      otherPhotos: "More photos",
      reviews: "Reviews written",
      firstReviews: "First review on a place",
      reviewsWithPhoto: "Reviews with your photo",
      reportsUpheld: "Reports upheld",
    },
    badge: {
      firstOnTheMap: {
        name: "First on the map",
        need: "The first review on a place that had none",
      },
      pioneer: { name: "Pioneer", need: "First photos on places that had none" },
      mapmaker: { name: "Mapmaker", need: "Places you added that are still on the map" },
      eventHost: { name: "Event host", need: "Events you added that ran" },
      knowsTheArea: { name: "Knows the area", need: "Contributions in a single town" },
      explorer: { name: "Explorer", need: "Different towns you have contributed in" },
      wellTravelled: { name: "Well travelled", need: "Different towns you have contributed in" },
      specialist: { name: "Specialist", need: "Contributions in a single category" },
      photographer: { name: "Photographer", need: "Photos you have added" },
      regular: { name: "Regular", need: "Reviews of 20 characters or more" },
      allSeasons: { name: "All seasons", need: "Contribute in both halves of the year" },
    },
  },
  sv: {
    title: "Utmärkelser",
    levelOf: "Nivå {{number}} av {{total}}",
    points: "poäng",
    toNext: "{{points}} till {{level}}",
    atTheTop: "Du har nått den högsta nivån. Härifrån handlar det om kartan, inte om siffran.",
    closest: "Närmast att bli klar",
    earnedOf: "{{earned}} av {{total}} uppnådda",
    bonus: "+{{points}}",
    howPoints: "Så räknas poängen",
    fromBadges: "Uppnådda utmärkelser",
    footnote:
      "Poängen kommer från det som fortfarande finns på kartan — det en moderator tar bort tar med sig sina poäng. Ingenting här jämförs med någon annan.",
    loadFailed: "Kunde inte hämta dina utmärkelser just nu. Gå tillbaka och försök igen.",
    signedOut: "Logga in för att se vad du har samlat på dig.",
    notForThisAccount:
      "Utmärkelser är till för dem som bidrar till kartan, så partner- och adminkonton samlar inte på dem.",
    group: {
      coverage: "Täckning — det kartan saknar",
      range: "Räckvidd — var du har varit",
      habit: "Vana — att hålla i det",
    },
    level: {
      newcomer: "Nykomling",
      contributor: "Bidragsgivare",
      regular: "Stammis",
      localExpert: "Lokalkännare",
      guide: "Guide",
      seniorGuide: "Erfaren guide",
      mapmaker: "Kartmakare",
      legend: "Legend",
    },
    line: {
      placesAdded: "Tillagda platser",
      firstPhotos: "Första bilden på en plats",
      eventsAdded: "Tillagda evenemang",
      otherPhotos: "Fler bilder",
      reviews: "Skrivna recensioner",
      firstReviews: "Första recensionen på en plats",
      reviewsWithPhoto: "Recensioner med egen bild",
      reportsUpheld: "Anmälningar som ledde till åtgärd",
    },
    badge: {
      firstOnTheMap: {
        name: "Först på kartan",
        need: "Den första recensionen på en plats som saknade en",
      },
      pioneer: { name: "Pionjär", need: "Första bilden på platser som saknade bild" },
      mapmaker: { name: "Kartmakare", need: "Platser du lagt till som finns kvar på kartan" },
      eventHost: { name: "Evenemangsvärd", need: "Evenemang du lagt till som ägde rum" },
      knowsTheArea: { name: "Känner området", need: "Bidrag på en och samma ort" },
      explorer: { name: "Upptäckare", need: "Olika orter du har bidragit på" },
      wellTravelled: { name: "Berest", need: "Olika orter du har bidragit på" },
      specialist: { name: "Specialist", need: "Bidrag inom en och samma kategori" },
      photographer: { name: "Fotograf", need: "Bilder du har lagt till" },
      regular: { name: "Flitig recensent", need: "Recensioner på minst 20 tecken" },
      allSeasons: { name: "Alla årstider", need: "Bidra under båda halvorna av året" },
    },
  },
};

export function achievementCopy(lang: string): AchievementCopy {
  return lang === "sv" ? ACHIEVEMENT_COPY.sv : ACHIEVEMENT_COPY.en;
}

/**
 * {{name}} substitution, because the website has no i18next to do it.
 *
 * The placeholders are written in i18next's syntax so the same strings can be
 * handed straight to the app's resources without a second set of them.
 */
export function fillCopy(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole
  );
}
