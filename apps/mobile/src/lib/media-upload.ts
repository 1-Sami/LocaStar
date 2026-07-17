import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

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

export async function uploadImageToMedia(path: string, uri: string): Promise<string> {
  const file = new File(uri);
  const arrayBuffer = await file.arrayBuffer();

  const { error } = await supabase.storage
    .from('media')
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from('media').getPublicUrl(path);
  return data.publicUrl;
}
