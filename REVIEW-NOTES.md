# Pre-content review — 2026-08-01

A full pass over the app, the shared API layer and the live database, done the
night before locations start going in. Three things were fixed; everything else
below is a suggestion, not a change.

## Fixed

1. **Share links pointed at a domain LocaStar doesn't own.**
   `public-link.ts` defaulted to `https://locastar.app`; the site is
   `locastar.se`. Every "Copy link" produced a dead URL. — `src/lib/public-link.ts`

   Note: the old URL is compiled into the shipped bundles. The current
   `apps/mobile/dist/` web export still contains `locastar.app`, and so does
   every installed copy of the app. This fix reaches nobody until the web
   build is rebuilt and redeployed **and** an `eas update` goes out. A `git
   push` updates the website, not the app.

2. **The add-location success screen described an approval queue that doesn't exist.**
   It said "submitted for review… goes live once approved". The insert policy
   requires `status = 'active'` and the read policy shows it immediately, so
   locations are live on submit — which is also what the disclaimer on the same
   form says. The two contradicted each other. Now it says it's live (or, for a
   scheduled activity, gives the publish date). — `src/app/add-location.tsx`

3. **The opening map pin was never geocoded, so `city` and `country` saved as null.**
   Those two columns are *only* ever filled from the reverse-geocode in
   `handlePinChange`. Anyone who left the pin where their phone put it submitted
   with both null, which blanks the city line on every card. The initial pin now
   goes through the same path. — `src/app/add-location.tsx`

## Verified working

- `tsc --noEmit` clean across the workspace.
- Full add-location write path, probed live as a **non-admin** user in a
  rolled-back transaction: location + category + photo insert, and the result
  comes straight back out of `nearby_locations` with city, country, category
  label and cover photo. This path is ready.
- Both cron jobs are active: hourly expired-activity delete, nightly empty-list
  cleanup.
- Database is clean and ready: 0 locations, 0 reviews, 48 categories.
- Security advisors: the only ERROR is the known `spatial_ref_sys` PostGIS
  false positive. Everything else is INFO/WARN.

---

# Second pass — 2026-08-03

## Fixed this pass

- **[A] `is_banned()` disclosed ban status to anonymous callers.** 0062 closed
  this for signed-in users by requiring `target = auth.uid() or is_moderator()`,
  with an escape hatch for `auth.uid() is null` — "a trigger, migration or
  service-role context". But `anon` has no `sub` claim either, so every
  unauthenticated REST caller took that branch. `/rest/v1/rpc/is_banned` with
  nothing but the publishable key returned the truth, and `profiles` is
  world-readable, so the ids to ask about were free: moderation state for every
  account, enumerable by anyone. Probed before and after — anon now gets `false`,
  self/moderator/trigger still get the truth, and all 20 enforcement policies use
  the no-argument form so enforcement is untouched.
  — `supabase/migrations/0078_is_banned_no_anon_leak.sql`

- **[B] The web build could silently stop serving a new dynamic route.** The
  script threw if a *declared* route went missing, but a newly added one — say
  `profile/[id]` — would export fine and then 404 in production with no other
  symptom. It now walks `dist` and fails on any bracket file not in
  `DYNAMIC_ROUTES`. — `apps/mobile/scripts/build-web.mjs`

- **[C] Expo starter-template leftovers.** `AnimatedIcon` in both
  `animated-icon.tsx` and `animated-icon.web.tsx` was unrendered code drawing the
  *Expo* logo on Expo-blue, plus `animated-icon.module.css`, `expo-logo.png`,
  `expo-badge*.png`, `react-logo*.png`, `tutorial-web.png`, `logo-glow.png` and
  the whole `tabIcons/` folder — none referenced (the tab bar uses SF Symbols and
  Material names). Repo tidiness only: unreferenced assets were never bundled, so
  this does not shrink the app.

- **[D] `build-web.mjs` had the same DEP0190 shell hazard** already fixed in
  `publish-update.mjs` — an args array passed with `shell: true`, which Node
  concatenates without escaping.

## Worth knowing, no action taken

- **[E] The duplicate check was doing nothing for two days.** `add-location`
  looks for existing locations within `DUPLICATE_RADIUS_M = 200`, but migration
  0076 broke `ST_DWithin` in `nearby_locations` (see 0077), so the radius was
  ignored and the query returned *every* location, sliced to five, ordered by a
  distance of zero. Anything added between 0076 and 0077 was shown five
  unrelated places as "already nearby". Fixed as a side effect of 0077; noted
  because it explains behaviour that looked like a bug in the form.

- **[F] `hours_not_applicable` is now a legacy column.** Neither form writes
  `true` any more, and the edit screen converts existing `true` rows to 24/7
  hours on load. Once no rows carry it, the column and its display branch on the
  location screen can go. Don't drop it before then.

- **[G] Resolved since the first pass:** [1] second account exists (`sadek2`),
  [2] location-photo ownership closed by 0075, [4] `locastar.se/location/<id>`
  confirmed serving. [19] is still open and now has teeth: running `expo lint`
  on this machine edits `package.json`, rewrites ~2400 lines of `pnpm-lock.yaml`,
  edits `pnpm-workspace.yaml` and drops a stray `app.json` at the repo root. It
  is a trap, not just a missing feature.

---

# Waiting on the next native build

These cannot ship over the air. An `eas update` only replaces JavaScript and
assets; anything that adds a native module needs a new binary, and publishing
JS that imports a module the installed binary lacks **crashes the app on
launch** — which would also block every further OTA until everyone reinstalled.

- **[R1] Reminders for dated activities.** Agreed feature: when someone saves an
  activity, notify them on the start date and on the last day. `starts_at` and
  `expires_at` are already stored, so there is no schema work. It needs
  `expo-notifications`, which is **not currently a dependency** — the app's
  "notifications" today are database rows polled every 30s by
  `notifications-context`, not OS notifications. Plan: on-device scheduled
  notifications keyed to the bucket-list save, a permission prompt, and an
  off switch in Settings → Notifications. No server or push infrastructure.

- **[R2] iOS universal links** — needs `apple-app-site-association` on
  locastar.se plus an `associatedDomains` entitlement, so it is an entitlement
  change and a rebuild. Blocked on an Apple Team ID, which needs the Apple
  Developer Program. Deferred by the owner until launch day.

Both should go into the same build, alongside the production profile for the
stores.

---

## Ideas to go over

### Before you start adding content

- **[1] Make yourself a second, non-admin account.** Only one account exists
  (`sam_86`), and it's an admin. Every RLS restriction is silently bypassed for
  you, so testing tomorrow will not show you what an ordinary contributor sees.

- **[2] Anyone can attach a photo to any location.** The `location_photos`
  INSERT policy checks `auth.uid() = user_id` and nothing about the location —
  I confirmed with a probe that a user can attach a photo to a location they
  did not create. No screen does this, but the REST API is open to anyone with
  the anon key. Worth tightening before there's content worth vandalising.

- **[3] Turn on leaked-password protection** in Supabase Auth. One dashboard
  toggle, flagged by the advisor.

- **[4] Confirm `locastar.se/location/<id>` actually serves** before relying on
  share links — fix #1 above assumes the deployed web build is live there.

### Add-location flow

- **[5] `submitLocation` is two unguarded writes.** The location goes in, then
  the categories in a separate statement. If the second fails you're left with a
  category-less location, which shows as "Other" everywhere and matches no
  filter. A single RPC would make it atomic.

- **[6] Debounce the pin.** Every drag fires both a reverse-geocode and a
  nearby-duplicates query.

- **[7] No manual override for city/country.** They come only from the
  geocoder. If it returns nothing they're silently lost and there is no field to
  correct them.

- **[8] The map is a WebView loading Leaflet from unpkg.** No internet (or a
  blocked CDN) means no map and no way to set a pin. Also `react-native-webview`
  has no web implementation, so the pin picker is probably broken in the web
  build — worth checking if you care about adding locations from a browser.

- **[9] Dead style:** `styles.warningText` in `add-location.tsx` is unused.

### Permissions — inconsistencies worth a decision

- **[10] The Edit button checks `isAdmin`, the database checks `is_moderator()`.**
  A moderator who isn't an admin can edit through the API but sees no button.
  The same file uses `isModerator` for photo reordering 250 lines earlier.

- **[11] A creator can neither edit nor delete their own location.** The trigger
  pins name, description, address and hours; delete is admin-only. That looks
  deliberate, but it will generate support mail once real people add real
  places. Consider a short edit window after creation, or an in-app "request a
  change" route.

- **[12] The creator guard pins columns by name, and it's out of date.**
  `city`, `country`, `starts_at`, `publish_at`, `available_summer` and
  `available_winter` were all added after the guard was written, so none of them
  are pinned — a creator can change them. Some of that may be what you want;
  decide rather than inherit it. Longer term an allow-list would stop this
  drifting every time a column is added.

### Search and discovery — matters once there's content

- **[13] `search_text` doesn't include `city` or `country`.** Both were added
  after the generated column was defined. City usually appears in the address so
  it mostly works by accident.

- **[14] No stemming, no fuzzy matching.** Search uses the `simple` tsvector
  config plus a `name ILIKE`, so "padel" won't find "padelbana" in a
  description. `pg_trgm` is already installed and unused here.

- **[15] Rating sort has no tiebreaker.** Every new location is 0.0, so sorting
  by rating returns them in arbitrary order. Distance as a secondary sort would
  fix it.

- **[16] `is_boosted` does nothing.** It's stored, returned by
  `nearby_locations`, and never used in the ordering.

- **[17] Expiry deletes.** An expired activity and its reviews are deleted
  outright, and only hourly — so one can linger up to an hour past its end, then
  vanish permanently. Hiding rather than deleting would be recoverable.

### Platform and release

- **[18] iOS universal links are not set up.** Android has `intentFilters` plus
  a verified `assetlinks.json`; there's no `apple-app-site-association` and no
  `associatedDomains` entitlement, so auth email links won't open the iOS app.

- **[19] `pnpm lint` doesn't work.** ESLint isn't a devDependency, so `expo lint`
  tries to install it on the fly — and that install fails on this machine
  (`ERR_PNPM_IGNORED_BUILDS` on `unrs-resolver`). Either add ESLint properly or
  drop the script so it isn't a trap.

- **[20] `delete_own_account()` is granted to `anon`.** It raises "Not signed in"
  so it isn't exploitable, but the grant is untidy and the advisor flags it.
