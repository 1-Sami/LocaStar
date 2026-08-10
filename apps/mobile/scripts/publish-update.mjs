#!/usr/bin/env node
/**
 * Bump APP_RELEASE and publish the over-the-air update in one step.
 *
 *   npm run release            → patch  (1.0.2 → 1.0.3)
 *   npm run release -- minor   → minor  (1.0.3 → 1.1.0)
 *   npm run release -- major   → major  (1.1.0 → 2.0.0)
 *
 * One step on purpose. Bumping the constant and publishing are only useful
 * together: bump without publish and the About screen claims a version nobody
 * can download; publish without bump and two different bundles both call
 * themselves the same version, which makes a bug report impossible to place.
 *
 * The bump is reverted if the publish fails, so a failed run leaves the tree
 * exactly as it found it. Committing is left to you — this only touches one
 * file, and it is deliberately not the script's business to decide when your
 * work is ready to record.
 */
import { execFileSync, execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const releaseFile = resolve(appRoot, 'src/constants/release.ts');

/*
 * Every branch that has a build subscribed to it. Publishing to any other
 * branch succeeds loudly and reaches nobody.
 *
 * There are two now. `preview` is the internal build on the owner's own phone;
 * `production` was created by the first Play build and is what the closed-test
 * testers are running. A bundle is compatible with both, because runtimeVersion
 * follows app.json's `version` and both builds were cut at 1.0.0 — so the same
 * update is published to each rather than making the release script ask a
 * question nobody will remember to answer correctly.
 *
 * The failure this prevents is silent: publish to `preview` alone and the fix
 * looks shipped, the dashboard agrees, and not one tester ever receives it.
 *
 * When a build is cut against a new app.json `version`, its runtimeVersion
 * changes and it stops matching updates built for the old one. At that point
 * this list needs revisiting, not extending.
 */
const BRANCHES = ['preview', 'production'];
// Must be an environment that actually holds the Supabase keys, or the bundle
// ships without them and the app starts up unable to talk to anything.
const ENVIRONMENT = 'production';

const bump = process.argv[2] ?? 'patch';
if (!['patch', 'minor', 'major'].includes(bump)) {
  console.error(`Unknown bump "${bump}". Expected patch, minor or major.`);
  process.exit(1);
}

const original = readFileSync(releaseFile, 'utf8');
const match = original.match(/export const APP_RELEASE = '(\d+)\.(\d+)\.(\d+)';/);
if (!match) {
  console.error(`Could not find APP_RELEASE in ${releaseFile}.`);
  process.exit(1);
}

const [major, minor, patch] = match.slice(1, 4).map(Number);
const next =
  bump === 'major' ? `${major + 1}.0.0` : bump === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;

const updated = original.replace(match[0], `export const APP_RELEASE = '${next}';`);
writeFileSync(releaseFile, updated);
console.log(`APP_RELEASE ${match[1]}.${match[2]}.${match[3]} → ${next}`);

const message = process.argv.slice(3).join(' ').trim();

const argsFor = (branch) => [
  'eas-cli@latest',
  'update',
  '--branch',
  branch,
  '--environment',
  ENVIRONMENT,
  '--message',
  message ? `v${next} — ${message}` : `v${next}`,
  '--non-interactive',
];

// Windows needs a shell: Node refuses to spawn a .cmd directly
// (CVE-2024-27980). Building the whole command as one string and handing it to
// execSync is the supported way to do that — passing an args array alongside
// `shell: true` works but is deprecated (DEP0190), because Node concatenates
// the arguments without escaping them. Everywhere else, no shell at all.
const onWindows = process.platform === 'win32';
const quote = (arg) => (/[\s"&|<>^]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg);

for (const branch of BRANCHES) {
  console.log(`\n> publishing v${next} to "${branch}"`);
  const args = argsFor(branch);
  try {
    if (onWindows) {
      execSync(['npx.cmd', ...args.map(quote)].join(' '), { cwd: appRoot, stdio: 'inherit' });
    } else {
      execFileSync('npx', args, { cwd: appRoot, stdio: 'inherit' });
    }
  } catch {
    // Put the bump back on any failure, including a later branch. A half
    // published release is worth reporting as a failure and retrying whole:
    // republishing a branch that already has this version is harmless, whereas
    // leaving the constant bumped would have the About screen claim a version
    // some devices cannot get.
    writeFileSync(releaseFile, original);
    console.error(
      `\nPublish to "${branch}" failed. APP_RELEASE put back to ${match[1]}.${match[2]}.${match[3]}.` +
        (branch === BRANCHES[0] ? '' : `\nEarlier branches may already have v${next} — run again to finish.`)
    );
    process.exit(1);
  }
}

console.log(
  `\nPublished v${next} to ${BRANCHES.join(' and ')}. ` +
    'Commit src/constants/release.ts so the repo agrees with what is live.'
);
