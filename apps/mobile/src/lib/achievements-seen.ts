import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Which badges this person has already been shown.
 *
 * On the device, not in the database. The only thing it buys is the count on
 * the Profile row — "2 NEW" — and paying for a table, a policy and a write on
 * every visit to carry that across a reinstall is not a trade worth making.
 * The cost is that a second phone shows the badges as new once, which is a
 * pleasant thing to get twice rather than a bug.
 *
 * Keyed by user id: two accounts on one handset must not inherit each other's
 * shelf. Every call swallows its own failure — storage being unavailable
 * should cost the pill, never the screen.
 */
const storageKey = (userId: string) => `achievements.seen.${userId}`;

export async function readSeenBadges(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

export async function markBadgesSeen(userId: string, keys: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(keys));
  } catch {
    // Next visit will simply offer the same badges as new again.
  }
}
