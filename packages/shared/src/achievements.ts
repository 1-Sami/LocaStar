/**
 * Points, badges and levels.
 *
 * Everything here is arithmetic over the counts `achievement_counts_of()`
 * returns (migrations 0147 and 0149). It is kept in TypeScript rather than in
 * SQL for two reasons: the app and the website must agree on the number without
 * asking the server twice, and these are the figures the owner will want to
 * move. Changing what a review is worth should be one line here, not a
 * migration — as it was on 2026-09-24, when a review went from 8 to 5.
 *
 * The principle underneath the weights: **pay for what it costs the person, not
 * for what is easy to count.** A photo means standing in the place with a
 * camera. A review can be typed on the sofa. So a photo pays more.
 *
 * There is deliberately no leaderboard and no ranking anywhere in this file.
 * Every number a person sees compares them to a threshold — 11 of 25 photos,
 * 297 points to the next level — and never to another person.
 */

import type { UserRole } from "./api/profile";

/** What the database gives us. Every number counts surviving content only. */
export type AchievementCounts = {
  placesAdded: number;
  eventsAdded: number;
  firstPhotos: number;
  otherPhotos: number;
  reviews: number;
  firstReviews: number;
  reviewsWithPhoto: number;
  reportsUpheld: number;
  towns: number;
  /** Contributions in whichever single town has the most. */
  bestTown: number;
  /** Contributions in whichever single category has the most. */
  bestCategory: number;
  summerContributions: number;
  winterContributions: number;
};

export const EMPTY_COUNTS: AchievementCounts = {
  placesAdded: 0,
  eventsAdded: 0,
  firstPhotos: 0,
  otherPhotos: 0,
  reviews: 0,
  firstReviews: 0,
  reviewsWithPhoto: 0,
  reportsUpheld: 0,
  towns: 0,
  bestTown: 0,
  bestCategory: 0,
  summerContributions: 0,
  winterContributions: 0,
};

/**
 * A review shorter than this earns nothing at all.
 *
 * Without a floor the cheapest possible contribution is also the most
 * repeatable one, and the ratings are what the rest of the app rests on.
 *
 * It was 40 for a day. The live data said that was too high: only two reviews
 * in the whole database cleared it, and "Jätte mysigt lekplats" — a real note
 * from a real tester — scored nothing. Twenty still stops a one-word rating
 * farming points and lets the short honest review count, which is the kind
 * most people write.
 *
 * ⚠ The same number is enforced in SQL (migration 0149). The client repeats it
 * only so a review can say so while it is being written. Change both or
 * neither.
 */
export const REVIEW_MIN_CHARACTERS = 20;

export const POINTS = {
  placeAdded: 30,
  firstPhoto: 25,
  eventAdded: 20,
  photo: 10,
  review: 5,
  firstReviewBonus: 15,
  reviewWithPhotoBonus: 10,
  reportUpheld: 5,
} as const;

export type ScoreLineId =
  | "placesAdded"
  | "firstPhotos"
  | "eventsAdded"
  | "otherPhotos"
  | "reviews"
  | "firstReviews"
  | "reviewsWithPhoto"
  | "reportsUpheld";

export type ScoreLine = {
  id: ScoreLineId;
  count: number;
  each: number;
  points: number;
};

/**
 * The contribution half of someone's score, itemised.
 *
 * Returned in full, zeros included, so the screen can decide whether to show a
 * line nobody has scored on yet — a zero next to "First photo of a place, 25"
 * is an invitation, which an absent row is not.
 */
export function scoreLines(counts: AchievementCounts): ScoreLine[] {
  const line = (id: ScoreLineId, count: number, each: number): ScoreLine => ({
    id,
    count,
    each,
    points: count * each,
  });
  return [
    line("placesAdded", counts.placesAdded, POINTS.placeAdded),
    line("firstPhotos", counts.firstPhotos, POINTS.firstPhoto),
    line("eventsAdded", counts.eventsAdded, POINTS.eventAdded),
    line("otherPhotos", counts.otherPhotos, POINTS.photo),
    line("reviews", counts.reviews, POINTS.review),
    line("firstReviews", counts.firstReviews, POINTS.firstReviewBonus),
    line("reviewsWithPhoto", counts.reviewsWithPhoto, POINTS.reviewWithPhotoBonus),
    line("reportsUpheld", counts.reportsUpheld, POINTS.reportUpheld),
  ];
}

export function contributionPoints(counts: AchievementCounts): number {
  let total = 0;
  for (const entry of scoreLines(counts)) total += entry.points;
  return total;
}

/* ------------------------------------------------------------------ badges */

export type BadgeGroup = "coverage" | "range" | "habit";

export type BadgeId =
  | "firstOnTheMap"
  | "pioneer"
  | "mapmaker"
  | "eventHost"
  | "knowsTheArea"
  | "explorer"
  | "wellTravelled"
  | "specialist"
  | "photographer"
  | "regular"
  | "allSeasons";

type BadgeDefinition = {
  id: BadgeId;
  group: BadgeGroup;
  /** How far along this person is, in the same unit as the tier targets. */
  progress: (counts: AchievementCounts) => number;
  /** One entry per tier. A single-entry list is an untiered badge. */
  tiers: { need: number; bonus: number }[];
  /**
   * True for a badge that waits rather than one you can go and finish. It is
   * kept out of "closest to done", whose whole job is to name something the
   * person could do this afternoon.
   */
  passive?: boolean;
};

/**
 * Eleven badges, seventeen things to earn.
 *
 * Three are tiered, which is how the shelf keeps giving without anyone having
 * to invent new ideas for it. The groups matter as much as the badges: the
 * first group is always the map's real gaps, so the most prominent thing on the
 * screen is the work that helps most.
 */
const BADGES: BadgeDefinition[] = [
  {
    id: "firstOnTheMap",
    group: "coverage",
    progress: (c) => c.firstReviews,
    tiers: [{ need: 1, bonus: 25 }],
  },
  {
    id: "pioneer",
    group: "coverage",
    progress: (c) => c.firstPhotos,
    tiers: [
      { need: 5, bonus: 50 },
      { need: 25, bonus: 150 },
      { need: 100, bonus: 500 },
    ],
  },
  {
    id: "mapmaker",
    group: "coverage",
    progress: (c) => c.placesAdded,
    tiers: [
      { need: 5, bonus: 50 },
      { need: 25, bonus: 200 },
      { need: 100, bonus: 750 },
    ],
  },
  {
    id: "eventHost",
    group: "coverage",
    progress: (c) => c.eventsAdded,
    tiers: [{ need: 3, bonus: 50 }],
  },
  {
    id: "knowsTheArea",
    group: "range",
    progress: (c) => c.bestTown,
    tiers: [{ need: 5, bonus: 40 }],
  },
  {
    id: "explorer",
    group: "range",
    progress: (c) => c.towns,
    tiers: [{ need: 5, bonus: 60 }],
  },
  {
    id: "wellTravelled",
    group: "range",
    progress: (c) => c.towns,
    tiers: [{ need: 15, bonus: 200 }],
  },
  {
    id: "specialist",
    group: "range",
    progress: (c) => c.bestCategory,
    tiers: [{ need: 10, bonus: 60 }],
  },
  {
    id: "photographer",
    group: "habit",
    progress: (c) => c.firstPhotos + c.otherPhotos,
    tiers: [
      { need: 25, bonus: 50 },
      { need: 100, bonus: 200 },
      { need: 500, bonus: 750 },
    ],
  },
  {
    id: "regular",
    group: "habit",
    progress: (c) => c.reviews,
    tiers: [{ need: 10, bonus: 40 }],
  },
  {
    /*
     * Both halves of the year, not both kinds of place. The badge belongs to
     * the habit group: it is for coming back when it is dark and cold, which
     * is a fact about when you contributed, not about what you contributed to.
     */
    id: "allSeasons",
    group: "habit",
    progress: (c) => Math.min(c.summerContributions, c.winterContributions),
    tiers: [{ need: 1, bonus: 50 }],
    // Needs half a year to pass, not an afternoon. Without this it ranked
    // second on a brand-new account's "closest to done" — a target of 1, and
    // nothing whatever the person could do about it today.
    passive: true,
  },
];

/** One earnable thing: a badge at a tier. `key` is stable and translatable. */
export type BadgeState = {
  id: BadgeId;
  group: BadgeGroup;
  /** See BadgeDefinition.passive — excluded from "closest to done". */
  passive: boolean;
  /** 1-based; 0 for an untiered badge. */
  tier: number;
  /** `pioneer` or `pioneer:2` — what the app stores to know what is new. */
  key: string;
  need: number;
  bonus: number;
  have: number;
  earned: boolean;
  /** 0 to 1. */
  fraction: number;
};

function stateOf(badge: BadgeDefinition, counts: AchievementCounts): BadgeState[] {
  const have = badge.progress(counts);
  const tiered = badge.tiers.length > 1;
  return badge.tiers.map((tier, index) => ({
    id: badge.id,
    group: badge.group,
    passive: badge.passive === true,
    tier: tiered ? index + 1 : 0,
    key: tiered ? `${badge.id}:${index + 1}` : badge.id,
    need: tier.need,
    bonus: tier.bonus,
    have,
    earned: have >= tier.need,
    fraction: tier.need === 0 ? 1 : Math.min(1, have / tier.need),
  }));
}

export function badgeStates(counts: AchievementCounts): BadgeState[] {
  const all: BadgeState[] = [];
  for (const badge of BADGES) {
    for (const state of stateOf(badge, counts)) all.push(state);
  }
  return all;
}

export function badgeBonusPoints(counts: AchievementCounts): number {
  let total = 0;
  for (const state of badgeStates(counts)) {
    if (state.earned) total += state.bonus;
  }
  return total;
}

/**
 * The three nearest unearned badges, closest first.
 *
 * This is the only part of the screen that changes what anyone does. "297
 * points to Guide" is trivia; "14 more photos and Pioneer II is yours" is a
 * task. Tiers already earned are skipped, and a badge nobody has started is
 * ranked below one that is half done.
 */
export function closestBadges(counts: AchievementCounts, limit = 3): BadgeState[] {
  return badgeStates(counts)
    .filter((state) => !state.earned && !state.passive)
    .sort((a, b) => {
      if (b.fraction !== a.fraction) return b.fraction - a.fraction;
      return a.need - a.have - (b.need - b.have);
    })
    .slice(0, limit);
}

/* ------------------------------------------------------------------ levels */

export type LevelId =
  | "newcomer"
  | "contributor"
  | "regular"
  | "localExpert"
  | "guide"
  | "seniorGuide"
  | "mapmaker"
  | "legend";

/**
 * Eight levels, close together at the start.
 *
 * One place and one first photo is 55 points, so the second level arrives on
 * the first afternoon — that rung is the one doing the work. The far end is out
 * of reach on purpose; nobody should finish this in a season.
 */
export const LEVELS: { id: LevelId; from: number }[] = [
  { id: "newcomer", from: 0 },
  { id: "contributor", from: 50 },
  { id: "regular", from: 150 },
  { id: "localExpert", from: 350 },
  { id: "guide", from: 700 },
  { id: "seniorGuide", from: 1200 },
  { id: "mapmaker", from: 2000 },
  { id: "legend", from: 3500 },
];

export type LevelState = {
  id: LevelId;
  /** 1-based, as shown: "Level 4 of 8". */
  number: number;
  from: number;
  next: { id: LevelId; from: number } | null;
  pointsToNext: number;
  /** Progress through the current level, 0 to 1. Full at the top level. */
  fraction: number;
};

export function levelFor(points: number): LevelState {
  let index = 0;
  for (let i = 0; i < LEVELS.length; i += 1) {
    if (points >= LEVELS[i].from) index = i;
  }
  const level = LEVELS[index];
  const next = index + 1 < LEVELS.length ? LEVELS[index + 1] : null;
  const span = next ? next.from - level.from : 0;
  return {
    id: level.id,
    number: index + 1,
    from: level.from,
    next,
    pointsToNext: next ? next.from - points : 0,
    fraction: next && span > 0 ? Math.min(1, (points - level.from) / span) : 1,
  };
}

/* ----------------------------------------------------------------- summary */

export type Achievements = {
  counts: AchievementCounts;
  lines: ScoreLine[];
  contributionPoints: number;
  badgePoints: number;
  points: number;
  level: LevelState;
  badges: BadgeState[];
  earnedCount: number;
  totalCount: number;
  closest: BadgeState[];
};

export function summarise(counts: AchievementCounts): Achievements {
  const badges = badgeStates(counts);
  const fromContributions = contributionPoints(counts);
  const fromBadges = badgeBonusPoints(counts);
  const points = fromContributions + fromBadges;
  let earned = 0;
  for (const badge of badges) {
    if (badge.earned) earned += 1;
  }
  return {
    counts,
    lines: scoreLines(counts),
    contributionPoints: fromContributions,
    badgePoints: fromBadges,
    points,
    level: levelFor(points),
    badges,
    earnedCount: earned,
    totalCount: badges.length,
    closest: closestBadges(counts),
  };
}

/**
 * Who sees any of this.
 *
 * Partners and admins do not. A kommun correcting four hundred of its own
 * places would hold every badge on the shelf by Tuesday — it is their job, not
 * a contribution, and it would make the shelf worthless for the people this
 * exists to encourage. Superusers do: they are ordinary members who volunteered
 * to moderate, and their photos and reviews are the same contributions as
 * anyone else's. Moderating itself scores nothing, so there is nothing to farm.
 *
 * This hides the screen; it never wipes the history behind it. Roles get
 * removed again, and emptying somebody's shelf because they helped for a month
 * would be a strange way to thank them.
 */
export function hasAchievements(role: UserRole): boolean {
  return role === "user" || role === "superuser";
}
