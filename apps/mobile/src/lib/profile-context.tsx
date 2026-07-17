import { fetchProfile } from '@locastar/shared';
import { File, Paths } from 'expo-file-system';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

type ProfileContextValue = {
  avatarUrl: string | null;
  localAvatarUri: string | null;
  username: string | null;
  refreshProfile: () => void;
};

const ProfileContext = createContext<ProfileContextValue>({
  avatarUrl: null,
  localAvatarUri: null,
  username: null,
  refreshProfile: () => {},
});

async function downloadAvatarLocally(url: string): Promise<string | null> {
  try {
    const fileName = url.split('/').pop()?.split('?')[0] || 'avatar.jpg';
    const destination = new File(Paths.cache, fileName);
    if (!destination.exists) {
      await File.downloadFileAsync(url, destination, { idempotent: true });
    }
    return destination.uri;
  } catch {
    return null;
  }
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  const refreshProfile = useCallback(() => {
    if (!session) {
      setAvatarUrl(null);
      setLocalAvatarUri(null);
      setUsername(null);
      return;
    }
    fetchProfile(supabase, session.user.id)
      .then(async (profile) => {
        setAvatarUrl(profile.avatar_url);
        setUsername(profile.username ?? profile.display_name);

        if (!profile.avatar_url || Platform.OS === 'web') {
          setLocalAvatarUri(null);
          return;
        }
        setLocalAvatarUri(await downloadAvatarLocally(profile.avatar_url));
      })
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  return (
    <ProfileContext.Provider value={{ avatarUrl, localAvatarUri, username, refreshProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useSharedProfile() {
  return useContext(ProfileContext);
}
