// Runs server/install.sh against a throw-away copy of the repo with a fake systemctl.
// It cannot start a real service or reach Firestore, so those steps are skipped or stubbed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, statSync, symlinkSync, writeFileSync, chmodSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateKeyPairSync } from 'node:crypto';

const repo = path.resolve(import.meta.dirname, '../..');
const deps = path.join(repo, 'server/node_modules/web-push');
// setsid drops the controlling terminal, so the script can never stop and wait for typing.
const canRun = process.platform === 'linux' && existsSync(deps)
  && spawnSync('setsid', ['--version']).status === 0;
const opts = { skip: canRun ? false : 'needs Linux, setsid and `npm install` in server/' };

// A copy of the repo layout (js/ + server/) with the real node_modules linked in.
function sandbox() {
  const root = mkdtempSync(path.join(tmpdir(), 'dozi-install-'));
  cpSync(path.join(repo, 'js'), path.join(root, 'js'), { recursive: true });
  cpSync(path.join(repo, 'package.json'), path.join(root, 'package.json'));
  mkdirSync(path.join(root, 'server'));
  for (const f of ['install.sh', 'package.json', 'package-lock.json']) {
    cpSync(path.join(repo, 'server', f), path.join(root, 'server', f));
  }
  cpSync(path.join(repo, 'server/src'), path.join(root, 'server/src'), { recursive: true });
  symlinkSync(path.join(repo, 'server/node_modules'), path.join(root, 'server/node_modules'));
  return root;
}

function fakeKey(dir, projectId = 'dozi-27dd5') {
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const file = path.join(dir, 'sa.json');
  writeFileSync(file, JSON.stringify({
    type: 'service_account', project_id: projectId, private_key: privateKey, client_email: 't@x.iam.gserviceaccount.com',
  }));
  return file;
}

function run(root, env = {}, { stubSystemctl = false } = {}) {
  const bin = path.join(root, 'bin');
  mkdirSync(bin, { recursive: true });
  const calls = path.join(root, 'systemctl-calls.txt');
  if (stubSystemctl) {
    writeFileSync(path.join(bin, 'systemctl'), `#!/bin/sh\necho "$@" >> "${calls}"\n[ "$1" = "is-active" ] && exit 0\nexit 0\n`);
    chmodSync(path.join(bin, 'systemctl'), 0o755);
  }
  const r = spawnSync('setsid', ['-w', 'bash', path.join(root, 'server/install.sh')], {
    encoding: 'utf8',
    env: {
      PATH: `${bin}:${process.env.PATH}`, HOME: root, DOZI_SKIP_NPM: '1', DOZI_SKIP_CHECK: '1', DOZI_NO_SUDO: '1',
      DOZI_NO_SYSTEMD: stubSystemctl ? '' : '1', ...env,
    },
  });
  const out = (r.stdout + r.stderr).replace(/\x1b\[[0-9;]*m/g, '');
  return { code: r.status, out, calls: existsSync(calls) ? readFileSync(calls, 'utf8') : '' };
}

const envOf = (root) => Object.fromEntries(
  readFileSync(path.join(root, 'server/.env'), 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => l.split(/=(.*)/s).slice(0, 2)),
);

test('a first install writes .env with private permissions and prints only the public key', opts, () => {
  const root = sandbox();
  const r = run(root, { DOZI_SA_PATH: fakeKey(root), DOZI_EMAIL: 'me@example.com' });
  assert.equal(r.code, 0, r.out);
  const env = envOf(root);
  assert.equal(statSync(path.join(root, 'server/.env')).mode & 0o777, 0o600);
  assert.equal(env.VAPID_SUBJECT, 'mailto:me@example.com');
  assert.equal(Buffer.from(env.VAPID_PUBLIC_KEY, 'base64url').length, 65);
  assert.ok(r.out.includes(env.VAPID_PUBLIC_KEY), 'the public key is shown');
  assert.equal(r.out.includes(env.VAPID_PRIVATE_KEY), false, 'the private key never appears in the output');
  assert.equal(statSync(env.GOOGLE_APPLICATION_CREDENTIALS).mode & 0o777, 0o600);
});

test('running it again keeps the keys and the e-mail', opts, () => {
  const root = sandbox();
  const sa = fakeKey(root);
  run(root, { DOZI_SA_PATH: sa, DOZI_EMAIL: 'me@example.com' });
  const first = envOf(root);
  const again = run(root, { DOZI_SA_PATH: sa }); // no e-mail given, no terminal: reuse the old one
  assert.equal(again.code, 0, again.out);
  const second = envOf(root);
  assert.equal(second.VAPID_PUBLIC_KEY, first.VAPID_PUBLIC_KEY);
  assert.equal(second.VAPID_PRIVATE_KEY, first.VAPID_PRIVATE_KEY);
  assert.equal(second.VAPID_SUBJECT, 'mailto:me@example.com');
  assert.match(again.out, /mevcut anahtarlar korunuyor/);
});

test('bad input stops with a clear message and writes nothing', opts, () => {
  const root = sandbox();
  const junk = path.join(root, 'junk.json');
  writeFileSync(junk, 'super secret garbage');
  const notAKey = run(root, { DOZI_SA_PATH: junk, DOZI_EMAIL: 'me@example.com' });
  assert.notEqual(notAKey.code, 0);
  assert.match(notAKey.out, /geçerli bir servis hesabı anahtarı değil/);
  assert.equal(notAKey.out.includes('super secret garbage'), false, 'never echoes the file');
  assert.equal(existsSync(path.join(root, 'server/.env')), false);

  const missing = run(root, { DOZI_SA_PATH: path.join(root, 'nope.json'), DOZI_EMAIL: 'me@example.com' });
  assert.notEqual(missing.code, 0);
  assert.match(missing.out, /Anahtar dosyası yok/);

  const noKey = run(root, { DOZI_EMAIL: 'me@example.com' });
  assert.notEqual(noKey.code, 0);
  assert.match(noKey.out, /DOZI_SA_PATH/);
});

test('a key from another project only warns', opts, () => {
  const root = sandbox();
  const r = run(root, { DOZI_SA_PATH: fakeKey(root, 'someone-else'), DOZI_EMAIL: 'me@example.com' });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /'someone-else' projesine ait/);
});

test('the service is installed, enabled and started, with the right paths', opts, () => {
  const root = sandbox();
  const unit = path.join(root, 'dozi-notifier.service');
  const r = run(root, { DOZI_SA_PATH: fakeKey(root), DOZI_EMAIL: 'me@example.com', DOZI_UNIT_PATH: unit }, { stubSystemctl: true });
  assert.equal(r.code, 0, r.out);
  const text = readFileSync(unit, 'utf8');
  assert.match(text, /^User=\S+$/m);
  assert.match(text, new RegExp(`^WorkingDirectory=${path.join(root, 'server').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  assert.match(text, /^ExecStart=\S*node --env-file=\S+\/server\/\.env src\/index\.js$/m);
  assert.match(text, /^Restart=always$/m);
  const calls = r.calls.trim().split('\n');
  assert.deepEqual(calls.slice(0, 2), ['daemon-reload', 'enable --now dozi-notifier']);
  assert.ok(calls.includes('is-active --quiet dozi-notifier'));
  assert.match(r.out, /servis çalışıyor/);
});
