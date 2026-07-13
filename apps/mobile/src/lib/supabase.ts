import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { createSupabaseClient } from '@locastar/shared';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

// AsyncStorage's web shim touches `window` unconditionally, which breaks
// expo-router's Node-side SSR pass for web. Native (iOS/Android) has no
// localStorage, so it needs AsyncStorage; web can use supabase-js's own
// default storage handling, which is already SSR-safe.
export const supabase = createSupabaseClient(url, anonKey, {
  auth: {
    ...(Platform.OS !== 'web' && { storage: AsyncStorage }),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
