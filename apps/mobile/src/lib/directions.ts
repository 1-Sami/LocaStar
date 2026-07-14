import { Linking, Platform } from 'react-native';

export function openDirections(address: string) {
  const encoded = encodeURIComponent(address);
  const webFallback = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
  const url = Platform.select({
    ios: `https://maps.apple.com/?daddr=${encoded}`,
    android: `google.navigation:q=${encoded}`,
    default: webFallback,
  });
  Linking.openURL(url).catch(() => Linking.openURL(webFallback));
}
