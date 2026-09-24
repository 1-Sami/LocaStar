#!/usr/bin/env node
/**
 * Bump APP_RELEASE and publish the over-the-air update in one step.
 *
 *   npm run release                     → 1.3.4 → 1.3.5
 *   npm run release "what you fixed"    → same, with a message
 *
 * **There is no bump argument any more, by the owner's rule (2026-09-24): the
 * last number counts all the way to 99 before the middle one moves.** So
 * 1.3.98 → 1.3.99 → 1.4.0, and 1.99.99 → 2.0.0. Nothing else.
 *
 * It used to take patch/minor/major, and v1.2.0 went straight to v1.3.0 for no
 * reason except that the change felt like a feature. That is exactly the call
 * this script no longer lets anyone make: these numbers are a running count of
 * over-the-air releases, not a claim about how big any one of them was. Asking
 * for `minor` or `major` now fails loudly rather than doing it quietly.
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
 * `preview` was deliberately dropped once the owner moved onto the Play build.
 * The last preview binary predates expo-notifications, so any bundle importing
 * it would crash that build on launch — and a crash on launch blocks every
 * further update, because the app never lives long enough to fetch one. Rather
 * than keep two binaries in step for one device, there is now one: the same
 * build the testers run, which also means a bug the owner hits is a bug they
 * hit.
 *
 * Adding a branch back means first checking the build behind it contains every
 * native module the bundle imports. That is the whole hazard.
 */
const BRANCHES = ['production'];
// Must be an environment that actually holds the Supabase keys, or the bundle
// ships without them and the app starts up unable to talk to anything.
const ENVIRONMENT = 'production';

const args = process.argv.slice(2);

if (args[0] === 'minor' || args[0] === 'major') {
  console.error(
    `"${args[0]}" is not a thing here any more.\n` +
      'The last number runs to 99 before the middle one moves — 1.3.98, 1.3.99, 1.4.0.\n' +
      'Just run: npm run release -- "what you fixed"'
  );
  process.exit(1);
}

// Still accepted, because it is what every run does and the habit is harmless.
if (args[0] === 'patch') args.shift();

const original = readFileSync(releaseFile, 'utf8');
const match = original.match(/export const APP_RELEASE = '(\d+)\.(\d+)\.(\d+)';/);
if (!match) {
  console.error(`Could not find APP_RELEASE in ${releaseFile}.`);
  process.exit(1);
}

/*
 * Count, carrying at 99.
 *
 * The three numbers are one counter, not three judgements: 1.3.99 is followed
 * by 1.4.0 and nothing else can produce a 1.4.0. Whether a release felt large
 * has no bearing on it, which is the point — that judgement is what put v1.2.0
 * next to v1.3.0 with a day between them.
 */
const [major, minor, patch] = match.slice(1, 4).map(Number);
const next =
  patch < 99
    ? `${major}.${minor}.${patch + 1}`
    : minor < 99
      ? `${major}.${minor + 1}.0`
      : `${major + 1}.0.0`;

const updated = original.replace(match[0], `export const APP_RELEASE = '${next}';`);
writeFileSync(releaseFile, updated);
console.log(`APP_RELEASE ${match[1]}.${match[2]}.${match[3]} → ${next}`);

const message = args.join(' ').trim();

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
