import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export async function pickImage(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    allowsEditing: true,
    aspect: [1, 1],
  });
  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0].uri;
}

export async function takePhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.7,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0].uri;
}

export async function pickImages(): Promise<string[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return [];

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    allowsMultipleSelection: true,
    selectionLimit: 0,
  });
  if (result.canceled || result.assets.length === 0) return [];
  return result.assets.map((asset) => asset.uri);
}

/**
 * Reads the bytes of a locally-picked image.
 *
 * On native, `fetch()` cannot read `file://` / `content://` URIs — it resolves
 * them to a "File not found" response whose *body* would then be uploaded as
 * the image (a 14-byte text file that renders as a black square). Read the
 * bytes off disk directly instead. Web still needs fetch, since the picker
 * hands back `blob:` URIs there.
 */
async function readLocalImageBytes(uri: string): Promise<Uint8Array> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) throw new Error(`Could not read the selected image (${response.status}).`);
    return new Uint8Array(await response.arrayBuffer());
  }
  return new File(uri).bytes();
}

// No real photo is this small. The old fetch-based read produced a 14-byte
// "File not found" body, so anything tiny means the read failed rather than
// that the user picked a very small image.
const MIN_PLAUSIBLE_IMAGE_BYTES = 256;

export async function uploadImageToMedia(path: string, uri: string): Promise<string> {
  const bytes = await readLocalImageBytes(uri);
  // Guard so a failed read can never silently become a corrupt upload again.
  if (bytes.byteLength < MIN_PLAUSIBLE_IMAGE_BYTES) {
    throw new Error(`The selected image could not be read (got ${bytes.byteLength} bytes).`);
  }

  const { error } = await supabase.storage
    .from('media')
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from('media').getPublicUrl(path);
  return data.publicUrl;
}
