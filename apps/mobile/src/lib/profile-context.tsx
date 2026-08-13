import { fetchProfile, isModeratorRole, updateProfile, type UserRole } from '@locastar/shared';
import { File, Paths } from 'expo-file-system';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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
  /**
   * The exact tier, for the few places where superuser and admin differ. Same
   * caveat as `isModerator`: a display hint only, never the thing that permits
   * anything.
   */
  role: UserRole;
  refreshProfile: () => void;
};

const ProfileContext = createContext<ProfileContextValue>({
  avatarUrl: null,
  localAvatarUri: null,
  username: null,
  isModerator: false,
  role: 'user',
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
  const { i18n } = useTranslation();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [role, setRole] = useState<UserRole>('user');

  const refreshProfile = useCallback(() => {
    if (!session) {
      setAvatarUrl(null);
      setLocalAvatarUri(null);
      setUsername(null);
      setIsModerator(false);
      setRole('user');
      return;
    }
    fetchProfile(supabase, session.user.id)
      .then(async (profile) => {
        setAvatarUrl(profile.avatar_url);
        setUsername(profile.username ?? profile.display_name);
        setIsModerator(isModeratorRole(profile.role));
        setRole(profile.role);

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

  /*
   * Tell the server which language to write to this person.
   *
   * The chosen language lived only in AsyncStorage on the device, so anything
   * sent from a background job — the activity reminders — had no way to know
   * it and went out in English to everyone. `profiles.locale` existed the
   * whole time and nothing had ever written to it.
   *
   * Fire and forget, and only when it actually differs: this runs on every
   * language change and every sign-in, and a failed write costs nothing worse
   * than a notification in the wrong language.
   */
  useEffect(() => {
    if (!session) return;
    const language = i18n.language?.startsWith('sv') ? 'sv' : 'en';
    let cancelled = false;

    fetchProfile(supabase, session.user.id)
      .then((profile) => {
        if (cancelled || profile.locale === language) return;
        return updateProfile(supabase, session.user.id, { locale: language });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [session, i18n.language]);

  return (
    <ProfileContext.Provider
      value={{ avatarUrl, localAvatarUri, username, isModerator, role, refreshProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useSharedProfile() {
  return useContext(ProfileContext);
}
