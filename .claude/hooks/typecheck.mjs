#!/usr/bin/env node
/**
 * Stop hook: don't let a turn finish on a broken typecheck.
 *
 * There are no tests in this repo, so `tsc --noEmit` is the only automatic
 * check that the code still holds together. Running it by hand works right up
 * until the once someone forgets, which is exactly the change that breaks.
 *
 * Written in Node rather than as a shell one-liner because `jq` is not
 * installed on this machine, and because a script can be read and tested.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let payload = {};
try {
  payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  // No stdin, or not JSON. Carry on — the check is still worth running.
}

// Set when the previous stop was already blocked by a hook. Blocking a second
// time would loop forever on an error the model cannot fix.
if (payload.stop_hook_active) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

try {
  execSync('npm run --silent typecheck', { cwd: root, stdio: 'pipe' });
} catch (error) {
  const output = [error.stdout, error.stderr]
    .filter(Boolean)
    .map(String)
    .join('\n')
    .trim();

  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason:
        'npm run typecheck failed, so the code does not currently compile. ' +
        'Fix these before finishing:\n\n' +
        output,
    })
  );
}

// Always exit 0: the JSON above is what blocks, and a non-zero exit here would
// only be reported as the hook itself having crashed.
process.exit(0);
