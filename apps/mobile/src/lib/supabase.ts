import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { createSupabaseClient } from '@locastar/shared';

// Trimmed because a value pasted into a CI settings box often carries
// whitespace or a trailing newline.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!url || !anonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

// A value pasted with surrounding quotes, or with the `NAME=` prefix left on,
// is non-empty so it passes the check above, then fails much later inside
// supabase-js as "Invalid supabaseUrl" — during the static-render pass, with a
// stack full of bundled code and no mention of the environment variable. Say
// what's actually wrong instead.
if (!/^https:\/\/[^\s"']+$/.test(url)) {
  throw new Error(
    `EXPO_PUBLIC_SUPABASE_URL is not a bare https URL (got ${JSON.stringify(url.slice(0, 60))}). ` +
      'It should be exactly https://<project-ref>.supabase.co — no quotes, no NAME= prefix.'
  );
}

if (!anonKey.startsWith('eyJ')) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY does not look like a JWT (it should start with "eyJ"). ' +
      'Check for quotes or a NAME= prefix in the value.'
  );
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
