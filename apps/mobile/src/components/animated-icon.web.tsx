/**
 * Web has no splash overlay.
 *
 * The native version covers the handover from the OS splash screen to the first
 * rendered frame. A browser has no such handover, so there is nothing to cover
 * and the overlay would only be a teal flash on load.
 *
 * This file exists so the import in _layout.tsx resolves on web — Metro picks
 * `.web.tsx` over `.tsx` automatically. Everything else that was here came from
 * the Expo starter template: an `AnimatedIcon` nobody rendered, drawing the
 * Expo logo on an Expo-blue gradient.
 */
export function AnimatedSplashOverlay() {
  return null;
}
