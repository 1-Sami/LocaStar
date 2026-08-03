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
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const releaseFile = resolve(appRoot, 'src/constants/release.ts');

// The EAS branch the built app subscribes to. Publishing to any other branch
// succeeds loudly and reaches nobody.
const BRANCH = 'preview';
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

try {
  execFileSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    [
      'eas-cli@latest',
      'update',
      '--branch',
      BRANCH,
      '--environment',
      ENVIRONMENT,
      '--message',
      message ? `v${next} — ${message}` : `v${next}`,
      '--non-interactive',
    ],
    { cwd: appRoot, stdio: 'inherit' }
  );
} catch {
  writeFileSync(releaseFile, original);
  console.error(`\nPublish failed. APP_RELEASE put back to ${match[1]}.${match[2]}.${match[3]}.`);
  process.exit(1);
}

console.log(`\nPublished v${next}. Commit src/constants/release.ts so the repo agrees with what is live.`);
