import { fetchBlockedUsers, blockUser as blockUserApi } from '@locastar/shared';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

/*
 * Who this account has blocked, held in memory so blocking can take effect
 * without a round trip.
 *
 * App Store guideline 1.2 requires that blocking someone "remove their content
 * from the user's feed instantly", and instantly is the load-bearing word: a
 * filter that only applies after a refetch is not one the person can see
 * working. So the set lives here, `block()` adds to it optimistically, and
 * every screen that renders somebody else's content asks `isBlocked` while it
 * maps.
 *
 * Deliberately a display filter rather than a database rule. Two reasons.
 * Blocking is about not having to look at someone, not about permissions — the
 * blocked person keeps every right they had, they simply stop appearing. And
 * the alternative, a policy on `reviews`, would put a per-row subquery on the
 * hottest read path in the app and mean editing a SELECT policy on a table
 * where doing that has already broken `INSERT … RETURNING` once, taking every
 * storage upload with it.
 *
 * The consequence to be honest about: this hides content, it does not withhold
 * it. Anyone reading the API directly still sees it. That is the correct
 * boundary for a block and the wrong one for a ban, which is enforced in the
 * database where it belongs.
 */
type BlockedUsersContextValue = {
  /** Ids this account has blocked. Empty while signed out. */
  blockedIds: Set<string>;
  /** Convenience for the map callbacks; null ids are never blocked. */
  isBlocked: (userId: string | null | undefined) => boolean;
  /** Blocks someone and hides them immediately, before the server confirms. */
  block: (targetUserId: string) => Promise<void>;
  /** Re-reads the list — for the unblock screen, which removes rows. */
  refresh: () => void;
};

const EMPTY: Set<string> = new Set();

const BlockedUsersContext = createContext<BlockedUsersContextValue>({
  blockedIds: EMPTY,
  isBlocked: () => false,
  block: async () => {},
  refresh: () => {},
});

export function BlockedUsersProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  /*
   * Stamped with whose blocks these are, rather than cleared on sign-out.
   *
   * Clearing would mean a setState in the effect body, and — more to the
   * point — between signing in as someone else and their list arriving there
   * would be a window showing the previous account's blocks. Carrying the id
   * lets the value be derived instead: a set that isn't yours counts as no
   * set at all, with no window and no effect to run.
   */
  const [loaded, setLoaded] = useState<{ userId: string; ids: Set<string> } | null>(null);

  const userId = session?.user.id ?? null;
  const blockedIds = loaded && loaded.userId === userId ? loaded.ids : EMPTY;

  const refresh = useCallback(() => {
    if (!userId) return;
    fetchBlockedUsers(supabase, userId)
      .then((rows) => setLoaded({ userId, ids: new Set(rows.map((row) => row.userId)) }))
      .catch((err) => {
        // Leave the last known set standing. Emptying it would un-hide
        // everyone the moment the network hiccuped, which is the one
        // direction this must never fail in.
        console.error('Failed to load blocked users', err);
      });
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const block = useCallback(
    async (targetUserId: string) => {
      if (!userId) return;
      // Optimistic on purpose: the content has to vanish on the tap, not on
      // the response. A failed write is re-read by the next refresh.
      setLoaded((current) => ({
        userId,
        ids: new Set(current?.userId === userId ? current.ids : []).add(targetUserId),
      }));
      try {
        await blockUserApi(supabase, userId, targetUserId);
      } catch (err) {
        console.error('Failed to block user', err);
        refresh();
        throw err;
      }
    },
    [userId, refresh]
  );

  const isBlocked = useCallback(
    (userId: string | null | undefined) => (userId ? blockedIds.has(userId) : false),
    [blockedIds]
  );

  return (
    <BlockedUsersContext.Provider value={{ blockedIds, isBlocked, block, refresh }}>
      {children}
    </BlockedUsersContext.Provider>
  );
}

export function useBlockedUsers() {
  return useContext(BlockedUsersContext);
}
