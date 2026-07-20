// Placeholder public web base URL — the mobile app has no deployed public
// web build yet, so links generated with this won't resolve until one
// exists at this domain. Override via EXPO_PUBLIC_WEB_BASE_URL once deployed.
const WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'https://locastar.app';

export function buildLocationShareLink(locationId: string): string {
  return `${WEB_BASE_URL}/location/${locationId}`;
}
