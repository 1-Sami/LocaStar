import { fetchSavedLocationIds, setSaved, type SaveKind } from '@locastar/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

export function useSaves() {
  const { session } = useAuth();
  const router = useRouter();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [bucketListIds, setBucketListIds] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    if (!session) {
      setFavoriteIds(new Set());
      setBucketListIds(new Set());
      return;
    }
    const [favorites, bucketList] = await Promise.all([
      fetchSavedLocationIds(supabase, session.user.id, 'favorite'),
      fetchSavedLocationIds(supabase, session.user.id, 'bucket_list'),
    ]);
    setFavoriteIds(favorites);
    setBucketListIds(bucketList);
  }, [session]);

  useEffect(() => {
    reload().catch(() => {});
  }, [reload]);

  const toggle = useCallback(
    async (locationId: string, kind: SaveKind) => {
      if (!session) {
        router.push('/sign-in');
        return;
      }
      const isFavoriteKind = kind === 'favorite';
      const currentSet = isFavoriteKind ? favoriteIds : bucketListIds;
      const setter = isFavoriteKind ? setFavoriteIds : setBucketListIds;
      const wasSaved = currentSet.has(locationId);

      const next = new Set(currentSet);
      if (wasSaved) {
        next.delete(locationId);
      } else {
        next.add(locationId);
      }
      setter(next);

      try {
        await setSaved(supabase, session.user.id, locationId, kind, !wasSaved);
      } catch {
        setter(currentSet);
      }
    },
    [session, favoriteIds, bucketListIds, router]
  );

  return {
    favoriteIds,
    bucketListIds,
    toggleFavorite: (id: string) => toggle(id, 'favorite'),
    toggleBucketList: (id: string) => toggle(id, 'bucket_list'),
    reloadSaves: reload,
  };
}
