import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Screens and dialogs need a browser to run, so a typo in one of them would only show up
// as a blank page. Parsing every client module catches that without a browser.
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (
    e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]
  ));
}

test('every client module parses', () => {
  const root = new URL('../js', import.meta.url).pathname;
  const js = files(root).filter((f) => f.endsWith('.js'));
  assert.ok(js.length > 30);
  for (const file of js) {
    const run = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(run.status, 0, `${path.relative(root, file)}: ${run.stderr.split('\n').slice(0, 4).join(' ')}`);
  }
});
