/**
 * The version number people see on the About screen.
 *
 * Bumped on every published update — `npm run release` does it, so the number
 * here and the message on the EAS dashboard cannot drift apart.
 *
 * Why this is not `version` in app.json: runtimeVersion follows the `appVersion`
 * policy, so changing app.json's version changes the runtime version too, and an
 * update built against the new runtime is not offered to a build running the old
 * one. Bumping it per over-the-air update would orphan every phone that already
 * has the app — the updates would publish successfully and reach nobody. This
 * constant lives in the JS bundle instead, so it ships *with* the update and
 * costs nothing.
 *
 * Which leaves two numbers, deliberately:
 *
 *   app.json `version`  the native/store version. Only moves when a new binary
 *                       goes out, which is exactly when the runtime version
 *                       *should* change, because old JS cannot run on it.
 *   APP_RELEASE         what the user sees. Starts equal to the store version
 *                       and takes a patch bump per over-the-air update.
 *
 * When a new native build ships, set both to the same number and carry on.
 */
export const APP_RELEASE = '1.0.51';
