import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

// Stockholm city center — used when permission is denied or unavailable so
// the app still has somewhere sensible to search from.
const FALLBACK_COORDS = { latitude: 59.3293, longitude: 18.0686 };

// How stale a cached fix may be and still be worth showing while the real one
// arrives. Long enough that there usually is one; short enough that the first
// distance you see is not from the town you left this morning.
const LAST_KNOWN_MAX_AGE_MS = 10 * 60 * 1000;

export function useUserLocation() {
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;

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
          if (lastKnown && !cancelled) {
            setCoords({ latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude });
            setLoading(false);
            haveSomething = true;
          }
        } catch {
          // No cached fix. Nothing to show yet; wait for the fresh one.
        }

        try {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (!cancelled) {
            setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
          }
        } catch (error) {
          // Don't throw away a cached position we are already showing just
          // because the fresh reading timed out — it is the better answer of
          // the two, and replacing it with Stockholm would be a regression.
          if (!haveSomething) throw error;
        }
      } catch {
        if (!cancelled) {
          setCoords(FALLBACK_COORDS);
          setUsingFallback(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    resolveLocation();
    return () => {
      cancelled = true;
    };
  }, []);

  return { coords, loading, usingFallback };
}
