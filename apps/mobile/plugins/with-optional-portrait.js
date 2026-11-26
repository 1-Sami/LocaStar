/**
 * Keep the portrait lock, but stop it costing us devices.
 *
 * `"orientation": "portrait"` writes `screenOrientation="portrait"` onto the
 * activity, and Android treats that as an *implied required* hardware feature:
 * `android.hardware.screen.portrait`. Play then hides the app from anything
 * that can't present portrait — some Chromebooks, Android XR, fixed-landscape
 * tablets — and flags every release with "Required hardware feature
 * declarations are restricting your app's availability". Versions 1–8 all
 * carried it; versionCode 8 was sent through with "Ignore issue".
 *
 * Declaring the feature explicitly with required="false" overrides the
 * implied one. Phones still lock to portrait; the rest can now install.
 *
 * Manifest only — no native code — so runtimeVersion stays "1.0.51" and
 * every install keeps receiving OTA updates.
 */
const { withAndroidManifest } = require('expo/config-plugins');

const FEATURE = 'android.hardware.screen.portrait';

module.exports = function withOptionalPortrait(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const features = (manifest['uses-feature'] ??= []);
    const existing = features.find((f) => f.$?.['android:name'] === FEATURE);
    if (existing) {
      existing.$['android:required'] = 'false';
    } else {
      features.push({ $: { 'android:name': FEATURE, 'android:required': 'false' } });
    }
    return cfg;
  });
};
