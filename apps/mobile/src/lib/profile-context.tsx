import { fetchProfile, isModeratorRole } from '@locastar/shared';
import { File, Paths } from 'expo-file-system';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

type ProfileContextValue = {
  avatarUrl: string | null;
  localAvatarUri: string | null;
  username: string | null;
  /**
   * Whether the signed-in user is a superuser or admin. Only ever a hint for
   * what to *show* — every moderator action is enforced by RLS, so a client
   * that lied about this would still be refused by the database.
   */
  isModerator: boolean;
  refreshProfile: () => void;
};

const ProfileContext = createContext<ProfileContextValue>({
  avatarUrl: null,
  localAvatarUri: null,
  username: null,
  isModerator: false,
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
  const [isModerator, setIsModerator] = useState(false);

  const refreshProfile = useCallback(() => {
    if (!session) {
      setAvatarUrl(null);
      setLocalAvatarUri(null);
      setUsername(null);
      setIsModerator(false);
      return;
    }
    fetchProfile(supabase, session.user.id)
      .then(async (profile) => {
        setAvatarUrl(profile.avatar_url);
        setUsername(profile.username ?? profile.display_name);
        setIsModerator(isModeratorRole(profile.role));

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
    <ProfileContext.Provider
      value={{ avatarUrl, localAvatarUri, username, isModerator, refreshProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useSharedProfile() {
  return useContext(ProfileContext);
}
