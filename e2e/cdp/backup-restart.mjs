// Real-browser check: the rolling backup survives a browser restart that
// loses tabs (the crash case). Quit with a backup in place, relaunch the same
// profile with different tabs, let Chrome fire the alarm, and expect the
// pre-restart backup to be kept as its own session.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { launch, eventually, sleep } from './harness.mjs';

const PROFILE = mkdtempSync(path.join(tmpdir(), 'snaptabs-restart-'));
const url = (x) => `https://example.com/?snaptabs=${x}`;
const sessions = (b) => b.evalSW(`return (await chrome.storage.local.get('snaptabs_sessions')).snaptabs_sessions ?? [];`);
let failed = 0;
let b;
try {
  b = await launch({ userDataDir: PROFILE });
  const page = await b.openExtensionPage('popup.html');
  await b.evalSW(`for (const x of ['w1', 'w2', 'w3', 'w4', 'w5', 'w6']) await chrome.tabs.create({ url: 'https://example.com/?snaptabs=' + x });`);
  await sleep(1500);
  await page(`return chrome.runtime.sendMessage({ action: 'updateSettings', settings: { autoBackupMinutes: 5 } });`);
  const before = await eventually(async () => {
    const [bk] = (await sessions(b)).filter((s) => s.isBackup);
    assert.ok(bk && bk.tabs.length >= 6);
    return bk;
  });
  console.log('  ✓ backup taken before the restart');

  // "Crash": quit and relaunch the same profile.
  await b.close();
  b = await launch({ userDataDir: PROFILE });
  await sleep(2000);
  assert.equal((await sessions(b)).filter((s) => s.isBackup)[0]?.id, before.id);
  console.log('  ✓ backup still there after the restart');

  // Chrome reopens the previous tabs here; close them to model a crash where
  // Chrome's own restore fails and the tabs are gone.
  await b.evalSW(`for (const t of await chrome.tabs.query({})) if ((t.url || t.pendingUrl || '').includes('snaptabs=w')) await chrome.tabs.remove(t.id);`);
  await b.evalSW(`await chrome.tabs.create({ url: '${url('after-restart')}' });`);
  await sleep(1500);
  // Let Chrome fire the real alarm soon instead of in 5 minutes.
  await b.evalSW(`await chrome.alarms.create('snaptabs-backup', { delayInMinutes: 0.5, periodInMinutes: 5 });`);
  const after = await eventually(async () => {
    const s = await sessions(b);
    assert.equal(s.length, 2, `expected live backup + kept copy, got ${s.length}`);
    return s;
  }, 60_000);
  const live = after.find((s) => s.isBackup);
  const kept = after.find((s) => !s.isBackup);
  assert.deepEqual(live.tabs.map((t) => t.url).filter((u) => u.includes('snaptabs=')), [url('after-restart')]);
  assert.equal(kept.timestamp, before.timestamp);
  assert.deepEqual(kept.tabs.map((t) => t.url), before.tabs.map((t) => t.url));
  assert.match(kept.name, /^Rolling backup - /);
  console.log('  ✓ first backup after the restart kept the pre-restart backup as its own session');

  // A second backup in the same browser session must not keep another copy.
  await b.evalSW(`await chrome.tabs.create({ url: '${url('later')}' });`);
  await sleep(1500);
  await b.evalSW(`await chrome.alarms.create('snaptabs-backup', { delayInMinutes: 0.5, periodInMinutes: 5 });`);
  await eventually(async () => {
    const s = await sessions(b);
    const bk = s.find((x) => x.isBackup);
    assert.ok(bk.tabs.some((t) => t.url === url('later')));
    assert.equal(s.length, 2);
  }, 60_000);
  console.log('  ✓ later backups just update');
} catch (e) {
  failed++;
  console.log(`  ✘ ${e.stack}`);
} finally {
  await b?.close();
  rmSync(PROFILE, { recursive: true, force: true });
}
console.log(failed ? '\n1 failed' : '\n4 passed');
process.exit(failed ? 1 : 0);
