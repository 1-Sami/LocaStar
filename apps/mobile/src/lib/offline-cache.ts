import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The last good copy of a screen's data, kept on the phone.
 *
 * Only for a person's own saved things — favourites, bucket list, their lists.
 * Those are the one case worth keeping: you save places at home, travel to
 * them, and the place you most want to read the address of is the one you have
 * no signal at. Everything else the app shows is either somebody else's content
 * that moderation can withdraw, or distance-ordered and therefore wrong the
 * moment you have moved, so it is deliberately not cached.
 *
 * This is a read cache of data the app already displays. Nothing new is sent
 * anywhere, so it changes neither what the Privacy Policy says we collect nor
 * what Apple and Google are told. One rule holds it there: **never write the
 * user's own coordinates**. The policy promises those are not kept after a
 * search, and a cache keyed on "places near 59.33, 18.06" would quietly break
 * that. Cache places, never positions.
 *
 * Keyed by user id, like achievements-seen: two accounts on one handset must
 * not inherit each other's saves.
 */
const storageKey = (name: string, userId: string) => `offline.${name}.${userId}`;

/**
 * Every cached screen, named here rather than at its own call site.
 *
 * Sign-out clears this list. A screen that invented its own key locally would
 * be cached and never cleared, and nothing would say so.
 */
export const SAVED_CACHE = 'saved';
export const LISTS_CACHE = 'lists';
export const OFFLINE_CACHES = [SAVED_CACHE, LISTS_CACHE] as const;

/**
 * Past this, don't write.
 *
 * AsyncStorage on Android is a SQLite database with a 6 MB default, and raising
 * it needs a native build — which this feature deliberately avoids so it can
 * ship over the air. A few dozen saved places is tens of kilobytes, so half a
 * megabyte is far above any honest payload and only ever trips on something
 * pathological. Skipping the write loses the cache; filling the store would
 * break every other thing that uses it.
 */
const MAX_BYTES = 512 * 1024;

export type Cached<T> = { savedAt: string; data: T };

/**
 * The stored copy, or null if there isn't one.
 *
 * Returns null rather than throwing on anything unexpected — corrupt JSON, a
 * shape written by an older build, storage unavailable. A cache that cannot be
 * read is the same as no cache, and must never be the reason a screen fails.
 */
export async function readCache<T>(name: string, userId: string): Promise<Cached<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(name, userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as Cached<T>).savedAt !== 'string' ||
      !('data' in parsed)
    ) {
      return null;
    }
    return parsed as Cached<T>;
  } catch {
    return null;
  }
}

/** Replaces the stored copy. Silent on failure: a screen that loaded is a success. */
export async function writeCache(name: string, userId: string, data: unknown): Promise<void> {
  try {
    const body = JSON.stringify({ savedAt: new Date().toISOString(), data });
    if (body.length > MAX_BYTES) return;
    await AsyncStorage.setItem(storageKey(name, userId), body);
  } catch {
    // The screen already has its data. Losing the copy costs the next cold
    // start its head start and nothing else.
  }
}

/**
 * Drops every cached screen for one person.
 *
 * Called on sign-out. Somebody else picking up the handset and signing in gets
 * their own key, so this is not what stops a leak — it is so a shared phone
 * does not keep a list of the places you saved after you have left.
 */
export async function clearCache(userId: string, names: readonly string[]): Promise<void> {
  try {
    await AsyncStorage.multiRemove(names.map((name) => storageKey(name, userId)));
  } catch {
    // Nothing to do. The keys are per-user and will be overwritten on next use.
  }
}
