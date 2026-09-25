// Real-browser check for the rolling backup (chrome.alarms + storage.onChanged
// in the service worker). Run with `npm run test:e2e:cdp` after a build.
import assert from 'node:assert/strict';
import { launch, eventually, sleep } from './harness.mjs';

const results = [];
async function check(name, fn) {
  try { await fn(); results.push([name, null]); console.log(`  ✓ ${name}`); }
  catch (e) { results.push([name, e]); console.log(`  ✘ ${name}\n    ${e.message}`); }
}

const browser = await launch();
try {
  const page = await browser.openExtensionPage('popup.html');
  await browser.evalSW(`await chrome.tabs.create({ url: 'https://example.com/?snaptabs=backup-1' });`);

  const backups = () => browser.evalSW(`
    const { snaptabs_sessions = [] } = await chrome.storage.local.get('snaptabs_sessions');
    return snaptabs_sessions.filter((s) => s.isBackup).map((s) => ({ id: s.id, urls: s.tabs.map((t) => t.url), ts: s.timestamp }));`);
  const alarm = () => browser.evalSW(`return (await chrome.alarms.get('snaptabs-backup')) ?? null;`);

  await check('no backup and no alarm while the setting is off', async () => {
    await sleep(500);
    assert.deepEqual(await backups(), []);
    assert.equal(await alarm(), null);
  });

  // Turn it on the way the popup does: by writing settings from a page.
  await page(`
    const { snaptabs_settings = {} } = await chrome.storage.local.get('snaptabs_settings');
    await chrome.storage.local.set({ snaptabs_settings: { ...snaptabs_settings, autoBackupMinutes: 5 } });`);

  let first;
  await check('turning it on schedules the alarm and takes a backup right away', async () => {
    const a = await eventually(async () => { const a = await alarm(); assert.ok(a); return a; });
    assert.equal(a.periodInMinutes, 5);
    const [b, ...rest] = await eventually(async () => { const b = await backups(); assert.equal(b.length, 1); return b; });
    assert.equal(rest.length, 0);
    assert.ok(b.urls.includes('https://example.com/?snaptabs=backup-1'));
    first = b;
  });

  await check('a service-worker restart does not postpone the alarm', async () => {
    const before = await alarm();
    await browser.evalSW(`globalThis.__beforeRestart = true;`);
    const sw = (await browser.targets()).find((t) => t.type === 'service_worker' && t.url.endsWith('/background.js'));
    await browser.browserCommand('Target.closeTarget', { targetId: sw.id });
    await sleep(500);
    // Wake it again with a message, as the popup would.
    await page(`return chrome.runtime.sendMessage({ action: 'getSettings' });`);
    assert.equal(await browser.evalSW(`return globalThis.__beforeRestart ?? false;`), false, 'service worker did not restart');
    const after = await alarm();
    assert.equal(after.scheduledTime, before.scheduledTime);
    assert.equal(after.periodInMinutes, 5);
  });

  await check('when Chrome fires the alarm, the same backup is updated with the new tabs', async () => {
    await browser.evalSW(`await chrome.tabs.create({ url: 'https://example.com/?snaptabs=backup-2' });`);
    // Pull the next firing forward to 30s (Chrome's minimum) so the test
    // doesn't wait 5 minutes; the period stays the same.
    await browser.evalSW(`await chrome.alarms.create('snaptabs-backup', { delayInMinutes: 0.5, periodInMinutes: 5 });`);
    const [b] = await eventually(async () => {
      const b = await backups();
      assert.equal(b.length, 1);
      assert.ok(b[0].urls.includes('https://example.com/?snaptabs=backup-2'));
      return b;
    }, 60_000);
    assert.equal(b.id, first.id);
  });

  await check('turning it off clears the alarm and keeps the last backup as a normal auto-save', async () => {
    await page(`
      const { snaptabs_settings = {} } = await chrome.storage.local.get('snaptabs_settings');
      await chrome.storage.local.set({ snaptabs_settings: { ...snaptabs_settings, autoBackupMinutes: 0 } });`);
    await eventually(async () => assert.equal(await alarm(), null));
    const sessions = await eventually(async () => {
      const s = await browser.evalSW(`return (await chrome.storage.local.get('snaptabs_sessions')).snaptabs_sessions;`);
      assert.equal(s.filter((x) => x.isBackup).length, 0);
      return s;
    });
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].id, first.id);
    assert.equal(sessions[0].isAutoSave, true);
    assert.match(sessions[0].name, /^Rolling backup - /);
  });
} catch (e) {
  results.push(['setup', e]);
  console.log(`  ✘ setup failed\n    ${e.stack}`);
} finally {
  await browser.close();
}
const failed = results.filter(([, e]) => e).length;
console.log(failed ? `\n${failed} failed` : `\n${results.length} passed`);
process.exit(failed ? 1 : 0);
