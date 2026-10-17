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


// ---- installing Node.js from nodejs.org (curl and uname are stubbed, nothing is downloaded) ----

import { createHash } from 'node:crypto';

// A fake nodejs.org: a tarball with a tiny `node`, and a SHASUMS256.txt that lists it.
function fakeDist(root, { arch = 'x64', wrongSum = false } = {}) {
  const dist = path.join(root, 'dist');
  const name = `node-v22.99.0-linux-${arch}`;
  const pkg = path.join(root, 'pkg', name, 'bin');
  mkdirSync(pkg, { recursive: true });
  mkdirSync(dist, { recursive: true });
  for (const bin of ['node', 'npm', 'npx']) {
    writeFileSync(path.join(pkg, bin), '#!/bin/sh\ncase "$1" in --version) echo v22.99.0 ;; *) exit 0 ;; esac\n');
    chmodSync(path.join(pkg, bin), 0o755);
  }
  const tar = `${name}.tar.gz`;
  const made = spawnSync('tar', ['-czf', path.join(dist, tar), '-C', path.join(root, 'pkg'), name]);
  assert.equal(made.status, 0);
  const sum = wrongSum ? '0'.repeat(64) : createHash('sha256').update(readFileSync(path.join(dist, tar))).digest('hex');
  writeFileSync(path.join(dist, 'SHASUMS256.txt'), [
    `${'a'.repeat(64)}  node-v22.99.0-linux-${arch}.tar.xz`, `${sum}  ${tar}`, `${'b'.repeat(64)}  node-v22.99.0-win-x64.zip`,
  ].join('\n') + '\n');
  return dist;
}

// A curl that serves files from a folder instead of the internet. Exit 22 = "not found", like curl -f.
function stubCurl(root, dist) {
  const bin = path.join(root, 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(path.join(bin, 'curl'), `#!/bin/sh
out=""; url=""
while [ $# -gt 0 ]; do case "$1" in -o) out=$2; shift 2 ;; -*) shift ;; *) url=$1; shift ;; esac; done
src="${dist}/\${url##*/}"
[ -f "$src" ] || exit 22
if [ -n "$out" ]; then cp "$src" "$out"; else cat "$src"; fi
`);
  chmodSync(path.join(bin, 'curl'), 0o755);
}

function stubUname(root, machine) {
  const bin = path.join(root, 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(path.join(bin, 'uname'), `#!/bin/sh\ncase "$1" in -m) echo ${machine} ;; -s) echo Linux ;; *) echo Linux ;; esac\n`);
  chmodSync(path.join(bin, 'uname'), 0o755);
}

// Runs only the Node.js step: with no key given the installer stops right after it.
function runNodeStep(root, extra = {}) {
  const prefix = path.join(root, 'optnode');
  const bindir = path.join(root, 'localbin');
  const r = run(root, {
    DOZI_FORCE_NODE_INSTALL: '1', DOZI_NODE_PREFIX: prefix, DOZI_NODE_BINDIR: bindir, DOZI_EMAIL: 'me@example.com', ...extra,
  });
  return { ...r, prefix, bindir };
}

test('Node.js is installed from the official tarball when it is missing or too old', opts, () => {
  const root = sandbox();
  stubCurl(root, fakeDist(root));
  const r = runNodeStep(root);
  assert.match(r.out, /Node\.js v22\.99\.0 kuruldu/, r.out);
  for (const bin of ['node', 'npm', 'npx']) {
    assert.ok(existsSync(path.join(r.bindir, bin)), `${bin} is linked into the bin folder`);
  }
  assert.ok(existsSync(path.join(r.prefix, 'node-v22.99.0-linux-x64/bin/node')));
});

test('the right build is picked for the processor (arm64 and armv7l too)', opts, () => {
  for (const [machine, arch] of [['aarch64', 'arm64'], ['armv7l', 'armv7l'], ['x86_64', 'x64']]) {
    const root = sandbox();
    stubCurl(root, fakeDist(root, { arch }));
    stubUname(root, machine);
    const r = runNodeStep(root);
    assert.match(r.out, /Node\.js v22\.99\.0 kuruldu/, `${machine}: ${r.out}`);
    assert.ok(existsSync(path.join(r.prefix, `node-v22.99.0-linux-${arch}`)), machine);
  }
});

test('a download that does not match its checksum is rejected and nothing is installed', opts, () => {
  const root = sandbox();
  stubCurl(root, fakeDist(root, { wrongSum: true }));
  const r = runNodeStep(root);
  assert.notEqual(r.code, 0);
  assert.match(r.out, /sağlama toplamı tutmuyor/);
  assert.equal(existsSync(path.join(r.bindir, 'node')), false);
  assert.equal(existsSync(r.prefix), false);
});

test('a processor without an official build gets a clear message', opts, () => {
  const root = sandbox();
  stubCurl(root, fakeDist(root));
  stubUname(root, 'armv6l');
  const r = runNodeStep(root);
  assert.notEqual(r.code, 0);
  assert.match(r.out, /armv6l/);
  assert.match(r.out, /Raspberry Pi 2\/3\/4\/5/);
});

test('when nodejs.org cannot be reached it says so', opts, () => {
  const root = sandbox();
  stubCurl(root, path.join(root, 'empty-dist'));
  const r = runNodeStep(root);
  assert.notEqual(r.code, 0);
  assert.match(r.out, /nodejs\.org'a ulaşılamadı/);
});
