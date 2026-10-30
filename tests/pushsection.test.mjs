import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPushSection } from '../js/pushUi.js';
import { setLang } from '../js/lang.js';

// The two switches and the test button, read back from the markup.
function parts(html) {
  const tag = (re) => html.match(re)?.[0] || '';
  const push = tag(/<button[^>]*role="switch"[^>]*>/);
  const nag = tag(/<input[^>]*data-nag[^>]*>/);
  return {
    push,
    nag,
    pushOn: /aria-checked="true"/.test(push),
    pushAction: /data-push="(\w+)"/.exec(push)?.[1],
    pushDisabled: /\sdisabled/.test(push),
    nagChecked: /\schecked/.test(nag),
    nagDisabled: /\sdisabled/.test(nag),
    hasTest: /data-push="test"/.test(html),
    text: /aria-live="polite">([^<]*)</.exec(html)?.[1],
  };
}

test('off and usable: the switch turns notifications on, the options wait', () => {
  const p = parts(renderPushSection({ status: 'ready' }));
  assert.equal(p.pushOn, false);
  assert.equal(p.pushAction, 'on');
  assert.equal(p.pushDisabled, false);
  assert.equal(p.nagDisabled, true, 'the hourly option means nothing while notifications are off');
  assert.equal(p.nagChecked, false, 'and it does not look switched on while nothing is sent');
  assert.equal(p.hasTest, false);
});

test('on: the switch turns them off, the hourly option and the test button are available', () => {
  const p = parts(renderPushSection({ status: 'on', nag: true }));
  assert.equal(p.pushOn, true);
  assert.equal(p.pushAction, 'off');
  assert.equal(p.nagDisabled, false);
  assert.equal(p.nagChecked, true);
  assert.equal(p.hasTest, true);
  assert.equal(parts(renderPushSection({ status: 'on', nag: false })).nagChecked, false);
});

test('states where nothing can be switched say why, and lock both switches', () => {
  const reasons = {};
  for (const status of ['hidden', 'needs-install', 'unsupported', 'denied']) {
    const p = parts(renderPushSection({ status }));
    assert.equal(p.pushDisabled, true, `${status}: switch locked`);
    assert.equal(p.nagDisabled, true, `${status}: hourly option locked`);
    assert.equal(p.nagChecked, false, `${status}: hourly option not shown as on`);
    assert.equal(p.hasTest, false, `${status}: no test button`);
    assert.ok(p.text && p.text.length > 10, `${status}: has a reason`);
    reasons[status] = p.text;
  }
  assert.equal(new Set(Object.values(reasons)).size, 4, 'each state has its own reason');
  assert.notEqual(
    parts(renderPushSection({ status: 'hidden', configured: false })).text,
    parts(renderPushSection({ status: 'hidden', configured: true })).text,
    'signed out and not set up are different problems',
  );
});

test('an installation without server push shows no hourly option', () => {
  const p = parts(renderPushSection({ status: 'hidden', configured: false }));
  assert.equal(p.nag, '');
});

test('while busy nothing can be pressed; a note replaces the status text and is escaped', () => {
  const p = parts(renderPushSection({ status: 'on', busy: true }));
  assert.equal(p.pushDisabled, true);
  assert.match(renderPushSection({ status: 'on', busy: true }), /data-push="test"[^>]*disabled/);
  const noted = parts(renderPushSection({ status: 'on', note: 'a <b>risky</b> note' }));
  assert.equal(noted.text, 'a &lt;b&gt;risky&lt;/b&gt; note');
});

test('the card follows the language', () => {
  setLang('en');
  try {
    const html = renderPushSection({ status: 'on' });
    assert.match(html, /Server notifications/);
    assert.match(html, /Send a test notification/);
    assert.doesNotMatch(html, /[çğıöşüÇĞİÖŞÜ]/);
  } finally {
    setLang('tr');
  }
});
