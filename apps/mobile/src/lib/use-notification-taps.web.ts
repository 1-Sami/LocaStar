/**
 * The web build has no notifications to be tapped.
 *
 * This exists because the native version does not merely do nothing useful on
 * web — it throws. `Notifications.useLastNotificationResponse()` raises
 * "ExpoNotifications.getLastNotificationResponse is not available on web", and
 * it is called from the root layout, so the error escaped during the first
 * render and React unmounted the entire tree. Every page of locastar.se served
 * an empty <div id="root">: /about, which is the support URL given to both
 * stores, the three legal pages Google Play requires, and every shared
 * /location/<id> link.
 *
 * None of that was visible to curl. The prerendered HTML contains the text and
 * returns 200 — the site only breaks once JavaScript runs, so every check that
 * fetched the markup said it was fine. It took rendering a page in a real
 * browser to see it.
 *
 * A platform-extension module rather than a `Platform.OS` check inside the hook:
 * the fix is to not call the native hook at all, and a conditional call would
 * break the rules of hooks to do it.
 */
export function useNotificationTaps(): void {
  // Deliberately empty.
}
