import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

// Stockholm city center — used when permission is denied or unavailable so
// the app still has somewhere sensible to search from.
const FALLBACK_COORDS = { latitude: 59.3293, longitude: 18.0686 };

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
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
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
