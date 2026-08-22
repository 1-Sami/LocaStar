# LocaStar

A map of things to actually go and do — courts, trails, slopes, festivals —
described by the people who have been there. Native app for iOS and Android.

## Layout

pnpm workspace. Four places code lives, and the split matters:

| Path | What belongs here |
|---|---|
| `apps/mobile/src/app/` | Screens. File-based routes (Expo Router). |
| `apps/mobile/src/components/` | Shared UI. |
| `apps/web/src/pages/` | The website. Astro, file-based routes, server-rendered on Cloudflare. |
| `packages/shared/src/api/` | **Every Supabase query.** Screens call these, never `supabase.from(...)` directly. |
| `supabase/migrations/` | Schema and RLS, numbered `NNNN_name.sql`. |
| `apps/mobile/scripts/` | Node build tooling — not app code. |
| `tools/` | One-off data tooling, e.g. the OpenStreetMap importer. Never shipped. |

`packages/shared` has no React and no DOM. It targets ES2020, so `console` is
not available there. Both the app and the website import from it, so a change
there lands in two products — including the legal text, which is deliberately
stored once so the copy Apple reviewed cannot drift from the copy on the site.

## Commands

```
npm run typecheck        # all three workspaces — run this after every change
npm run lint             # ESLint via expo lint (apps/mobile only)
cd apps/mobile && npm run release            # bump APP_RELEASE + publish OTA
cd apps/mobile && npm run release -- minor   # or major
cd apps/web && npm run deploy                # astro build + wrangler deploy
```

## The one thing that catches everyone

**`git push` updates neither the website nor the app.** There are three
pipelines from the same source, and pushing drives none of them:

- `git push` → GitHub only. Nothing deploys.
- `cd apps/web && npm run deploy` → the Astro site
- `npm run release` → EAS publishes a JS bundle to phones

**There are two web Workers, and the domain is still on the old one.** The
root `wrangler.jsonc` defines `locastar`, which serves the prerendered Expo
export in `apps/mobile/dist` and is what `locastar.se` currently resolves to.
`apps/web/wrangler.jsonc` defines `locastar-web`, the Astro rebuild, which
lives on its `workers.dev` address until somebody points the domain at it.

Until that cutover happens, a change to `apps/web` is not on `locastar.se`
however many times it is deployed. Check which Worker you are looking at before
concluding a fix did not work.

This file used to say pushing rebuilt the website, and that cost an afternoon:
three files added during the day were live in the repo, absent from the site,
and nobody had reason to look. `/legal/delete-account` 404'd while Google Play
was waiting for it, and `apple-app-site-association` 404'd too — which would
have made iOS universal links fail silently long after the app shipped.

A fix that is committed and pushed can be absent from *both* the website and
the app. Say which of the three you actually did.

**Over-the-air updates only replace JavaScript and assets.** Anything that adds
a *native module* needs a new binary — and publishing JS that imports a native
module the installed app lacks **crashes it on launch**, which then blocks every
further OTA until everyone reinstalls. Check `apps/mobile/package.json` before
importing anything new.

Two version numbers, deliberately: `app.json`'s `version` is the native/store
one and drives `runtimeVersion`, so bumping it stops existing installs receiving
updates. `APP_RELEASE` in `src/constants/release.ts` is what users see and moves
once per OTA. `npm run release` handles it.

## Working on the database

Migrations are applied through the Supabase MCP tools and committed to
`supabase/migrations/`. The project is live with real user data — treat every
row as someone's.

**Verify permission changes with a self-rolling-back probe, not by reading the
policy.** Set `request.jwt.claims`, `set local role authenticated`, do the
thing, then `raise exception` to roll it all back. This has repeatedly found
what reading could not:

- a `BEFORE UPDATE` trigger that silently reverts a permitted write and reports
  success — the API returns 200 and nothing changed
- a second *permissive* policy ORing with the one being tightened, making the
  restriction decorative
- an anonymous caller taking a branch meant for internal contexts, because
  `auth.uid()` is null for both

Also: adding a column can silently break a SQL function that has a parameter of
the same name — the column wins, with no error. See migration `0077`.

Credentials belong in the Supabase dashboard only. `supabase/config.toml` is
committed.

## Expo

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before
writing code against an Expo API. This SDK has moved a lot, and expo-router 57
vendors its own react-navigation fork — hooks you expect from
`@react-navigation/native` may not be exported.

New dependencies and `app.json` edits need the dev server fully restarted, not
reloaded.

## House style

Comments explain *why*, especially where the obvious approach is wrong or a
trap was hit. Match the density of the surrounding file. Don't leave a comment
stranded from the code it describes when inserting nearby.
