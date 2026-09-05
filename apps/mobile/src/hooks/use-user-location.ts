import * as Location from 'expo-location';
import { useEffect, useSyncExternalStore } from 'react';

// Stockholm city center — used when permission is denied or unavailable so
// the app still has somewhere sensible to search from.
const FALLBACK_COORDS = { latitude: 59.3293, longitude: 18.0686 };

// How stale a cached fix may be and still be worth showing while the real one
// arrives. Long enough that there usually is one; short enough that the first
// distance you see is not from the town you left this morning.
const LAST_KNOWN_MAX_AGE_MS = 10 * 60 * 1000;

// How long the fix one screen resolved stays good enough to hand straight to
// the next. Inside this window a screen paints from it and asks for nothing;
// past it, the screen still paints from it immediately and a fresh reading is
// started behind what is already on show.
const SHARED_FIX_MAX_AGE_MS = 2 * 60 * 1000;

type Coords = { latitude: number; longitude: number };

type LocationState = {
  coords: Coords | null;
  loading: boolean;
  usingFallback: boolean;
};

/*
 * One fix, shared by every screen that asks for it.
 *
 * Five screens call this hook, and the tab screens are never torn down — so
 * opening Search started a second acquisition from nothing while Home was
 * already holding the answer, and Search had no coordinates to search from
 * until the hardware answered a second time. Search shows a spinner until it
 * does, so that wait was the screen.
 *
 * Module scope rather than a context: where the phone is, is a fact about the
 * device rather than about any part of the tree, and every caller wants the
 * same answer. Read through useSyncExternalStore, which is what that hook is
 * for — subscribing to a store outside React without a synchronous setState in
 * an effect, and without two screens briefly disagreeing about where you are.
 */
let snapshot: LocationState = { coords: null, loading: true, usingFallback: false };
let resolvedAt = 0;
let inFlight: Promise<void> | null = null;

const listeners = new Set<() => void>();

// A new object only when something actually changed, because useSyncExternalStore
// compares snapshots by identity and would re-render forever on a fresh one.
function publish(coords: Coords, usingFallback: boolean) {
  snapshot = { coords, loading: false, usingFallback };
  resolvedAt = Date.now();
  // Copied first: a listener that re-renders can mount another subscriber, and
  // adding to a Set while iterating it would run the new one in the same pass.
  [...listeners].forEach((notify) => notify());
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function getSnapshot() {
  return snapshot;
}

async function resolveLocation() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permission not granted');
    }

    // getCurrentPositionAsync waits for the hardware to produce a fresh
    // fix, which is a few seconds of cards showing no distance at all. A
    // cached one comes back immediately, so show that first and refine it
    // when the real reading lands.
    let haveSomething = false;
    try {
      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: LAST_KNOWN_MAX_AGE_MS,
      });
      if (lastKnown) {
        publish(
          { latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude },
          false
        );
        haveSomething = true;
      }
    } catch {
      // No cached fix. Nothing to show yet; wait for the fresh one.
    }

    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      publish(
        { latitude: position.coords.latitude, longitude: position.coords.longitude },
        false
      );
    } catch (error) {
      // Don't throw away a cached position we are already showing just
      // because the fresh reading timed out — it is the better answer of
      // the two, and replacing it with Stockholm would be a regression.
      if (!haveSomething) throw error;
    }
  } catch {
    publish(FALLBACK_COORDS, true);
  }
}

function ensureFreshEnough() {
  // One acquisition at a time, however many screens mount at once.
  if (inFlight) return;

  const stale =
    snapshot.coords === null ||
    // The fallback is not a reading, it is the record of one that failed, so it
    // is always worth another try rather than being held for two minutes.
    snapshot.usingFallback ||
    Date.now() - resolvedAt > SHARED_FIX_MAX_AGE_MS;
  if (!stale) return;

  inFlight = resolveLocation().finally(() => {
    inFlight = null;
  });
}

export function useUserLocation() {
  // Third argument is the server snapshot, for the web export — the same store,
  // which starts out with no fix, exactly as it does on a phone.
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    ensureFreshEnough();
  }, []);

  return state;
}
