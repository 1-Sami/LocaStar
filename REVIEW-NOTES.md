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
