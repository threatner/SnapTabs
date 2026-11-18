// Real-browser check: saving tab groups when they're closed
// (docs/closed-groups/spec.md). Run with `npm run test:e2e:cdp` after a build.
import assert from 'node:assert/strict';
import { launch, eventually, sleep } from './harness.mjs';

const results = [];
async function check(name, fn) {
  try { await fn(); results.push([name, null]); console.log(`  ✓ ${name}`); }
  catch (e) { results.push([name, e]); console.log(`  ✘ ${name}\n    ${e.message}`); }
}

const b = await launch();
try {
  const page = await b.openExtensionPage('popup.html');
  const setSetting = (on) => page(`return chrome.runtime.sendMessage({ action: 'updateSettings', settings: { saveClosedGroups: ${on} } });`);
  const closedSessions = () => b.evalSW(`
    const { snaptabs_sessions = [] } = await chrome.storage.local.get('snaptabs_sessions');
    return snaptabs_sessions.filter((s) => s.name.endsWith('(closed group)'))
      .map((s) => ({ name: s.name, urls: s.tabs.map((t) => t.url), group: s.tabGroups[0] && { title: s.tabGroups[0].title, color: s.tabGroups[0].color } }));`);
  // Opens n tabs in a group, waits for SnapTabs to have seen it.
  const makeGroup = (title, n, color = 'green', windowId = null) => b.evalSW(`
    const w = ${windowId} ?? (await chrome.windows.getAll({ windowTypes: ['normal'] }))[0].id;
    const ids = [];
    for (let i = 0; i < ${n}; i++) ids.push((await chrome.tabs.create({ windowId: w, url: 'https://example.com/?cg=${title}-' + i, active: false })).id);
    const gid = await chrome.tabs.group({ tabIds: ids, createProperties: { windowId: w } });
    await chrome.tabGroups.update(gid, { title: '${title}', color: '${color}' });
    await new Promise((r) => setTimeout(r, 2500));
    return { ids, gid, w };`);
  const settle = () => sleep(1500);

  await setSetting(true);

  await check('closing a whole group saves it with its tabs, name and colour', async () => {
    const g = await makeGroup('Research', 3);
    await b.evalSW(`await chrome.tabs.remove(${JSON.stringify(g.ids)});`);
    const s = await eventually(async () => { const s = await closedSessions(); assert.equal(s.length, 1); return s; });
    assert.equal(s[0].name, 'Research (closed group)');
    assert.deepEqual(s[0].urls, [0, 1, 2].map((i) => `https://example.com/?cg=Research-${i}`));
    assert.deepEqual(s[0].group, { title: 'Research', color: 'green' });
  });

  await check('re-closing the same group with the same tabs replaces the earlier copy', async () => {
    const g = await makeGroup('Research', 3);
    await b.evalSW(`await chrome.tabs.remove(${JSON.stringify(g.ids)});`);
    await settle();
    assert.equal((await closedSessions()).filter((s) => s.name === 'Research (closed group)').length, 1);
  });

  await check('ungrouping saves nothing', async () => {
    const g = await makeGroup('Ungroup', 2);
    await b.evalSW(`await chrome.tabs.ungroup(${JSON.stringify(g.ids)});`);
    await settle();
    assert.ok(!(await closedSessions()).some((s) => s.name.startsWith('Ungroup')));
  });

  await check("closing a group's tabs one by one saves nothing", async () => {
    const g = await makeGroup('OneByOne', 3);
    for (const id of g.ids) { await b.evalSW(`await chrome.tabs.remove(${id});`); await sleep(700); }
    await settle();
    assert.ok(!(await closedSessions()).some((s) => s.name.startsWith('OneByOne')));
  });

  await check('closing a window that holds a group saves nothing (window close is handled elsewhere)', async () => {
    const w = await b.evalSW(`return (await chrome.windows.create({ url: 'https://example.com/?keep' })).id;`);
    await makeGroup('InWindow', 2, 'blue', w);
    await b.evalSW(`await chrome.windows.remove(${w});`);
    await settle();
    assert.ok(!(await closedSessions()).some((s) => s.name.startsWith('InWindow')));
  });

  await check('with the setting off, nothing is saved', async () => {
    await setSetting(false);
    const g = await makeGroup('Off', 2);
    await b.evalSW(`await chrome.tabs.remove(${JSON.stringify(g.ids)});`);
    await settle();
    assert.ok(!(await closedSessions()).some((s) => s.name.startsWith('Off')));
    await setSetting(true);
  });

  await check('a group closed while the service worker is stopped is still saved', async () => {
    const g = await makeGroup('Asleep', 2, 'purple');
    await b.evalSW(`globalThis.__beforeStop = true;`);
    const sw = (await b.targets()).find((t) => t.type === 'service_worker' && t.url === `chrome-extension://${b.extensionId}/background.js`);
    await b.browserCommand('Target.closeTarget', { targetId: sw.id });
    await sleep(500);
    // Close it from the popup page: the stopped worker wakes for the events.
    await page(`await chrome.tabs.remove(${JSON.stringify(g.ids)}); return 1;`);
    const s = await eventually(async () => {
      const s = (await closedSessions()).filter((x) => x.name === 'Asleep (closed group)');
      assert.equal(s.length, 1);
      return s;
    });
    assert.equal(await b.evalSW(`return globalThis.__beforeStop ?? false;`), false, 'service worker did not restart');
    assert.equal(s[0].urls.length, 2);
    assert.deepEqual(s[0].group, { title: 'Asleep', color: 'purple' });
  });

  await check('restoring a saved closed group recreates the group', async () => {
    const id = await b.evalSW(`
      const { snaptabs_sessions = [] } = await chrome.storage.local.get('snaptabs_sessions');
      return snaptabs_sessions.find((s) => s.name === 'Research (closed group)').id;`);
    await page(`return chrome.runtime.sendMessage({ action: 'restore', sessionId: '${id}' });`);
    const groups = await eventually(async () => {
      const gs = await b.evalSW(`return (await chrome.tabGroups.query({ title: 'Research' })).map((g) => ({ title: g.title, color: g.color }));`);
      assert.equal(gs.length, 1);
      return gs;
    });
    assert.deepEqual(groups[0], { title: 'Research', color: 'green' });
  });
} catch (e) {
  results.push(['setup', e]);
  console.log(`  ✘ setup failed\n    ${e.stack}`);
} finally {
  await b.close();
}
const failed = results.filter(([, e]) => e).length;
console.log(failed ? `\n${failed} failed` : `\n${results.length} passed`);
process.exit(failed ? 1 : 0);
