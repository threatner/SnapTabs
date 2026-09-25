// Real-browser check for restore + tab sleeping (chrome.tabs.discard), which
// Playwright can't cover. Run with `npm run test:e2e:cdp` after a build.
import assert from 'node:assert/strict';
import { launch, eventually } from './harness.mjs';

const url = (w) => `https://example.com/?snaptabs=${w}`;
const tab = (w, index, windowId, groupId) => ({ url: url(w), title: w, pinned: false, isIncognito: false, index, windowId, groupId });

const session = {
  id: 'cdp-sleep', name: 'Two windows', timestamp: Date.now(), windowCount: 2,
  tabGroups: [{ id: 41, title: 'Research', color: 'green', collapsed: false }],
  hasIncognitoTabs: false, isAutoSave: false,
  tabs: [tab('a1', 0, 7), tab('a2', 1, 7, 41), tab('a3', 2, 7, 41), tab('b1', 0, 3), tab('b2', 1, 3)],
};

const checks = [];
const check = (name, fn) => checks.push([name, fn]);

const browser = await launch();
let failed = 0;
try {
  await browser.evalSW(`await chrome.storage.local.set({ snaptabs_sessions: ${JSON.stringify([session])} });`);
  const popup = await browser.openExtensionPage('popup.html');
  const res = await popup(`return chrome.runtime.sendMessage({ action: 'restore', sessionId: 'cdp-sleep' });`);
  assert.deepEqual(res, { success: true });

  const byUrl = async () => browser.evalSW(`
    const out = {};
    for (const t of await chrome.tabs.query({})) {
      const u = t.url || t.pendingUrl || '';
      if (!u.includes('snaptabs=')) continue;
      const g = t.groupId > -1 ? await chrome.tabGroups.get(t.groupId) : null;
      out[new URL(u).searchParams.get('snaptabs')] = {
        id: t.id, windowId: t.windowId, index: t.index, active: t.active, discarded: t.discarded,
        title: t.title, url: t.url, group: g && { title: g.title, color: g.color },
      };
    }
    return out;`);

  const state = await eventually(async () => {
    const s = await byUrl();
    for (const w of ['a2', 'a3', 'b2']) assert.equal(s[w]?.discarded, true, `${w} should be asleep`);
    return s;
  });

  check('each saved window restores into its own window', () => {
    assert.equal(state.a1.windowId, state.a2.windowId);
    assert.equal(state.a1.windowId, state.a3.windowId);
    assert.equal(state.b1.windowId, state.b2.windowId);
    assert.notEqual(state.a1.windowId, state.b1.windowId);
  });
  check('tab order is preserved within each window', () => {
    assert.equal(state.a2.index, state.a1.index + 1);
    assert.equal(state.a3.index, state.a2.index + 1);
    assert.equal(state.b2.index, state.b1.index + 1);
  });
  check('the first tab of each window is focused and awake', () => {
    for (const w of ['a1', 'b1']) {
      assert.equal(state[w].active, true, `${w} active`);
      assert.equal(state[w].discarded, false, `${w} awake`);
    }
  });
  check('tab groups are recreated with their name and color, and survive sleeping', () => {
    assert.deepEqual(state.a2.group, { title: 'Research', color: 'green' });
    assert.deepEqual(state.a3.group, { title: 'Research', color: 'green' });
    assert.equal(state.a1.group, null);
  });
  check('sleeping tabs keep their URL and page title', () => {
    for (const w of ['a2', 'a3', 'b2']) {
      assert.equal(state[w].url, url(w));
      assert.equal(state[w].title, 'Example Domain');
    }
  });

  // Snapshot all windows while tabs are asleep: every URL must be captured.
  const snap = await popup(`return chrome.runtime.sendMessage({ action: 'snapshot', name: 'while asleep' });`);
  check('a snapshot of sleeping tabs captures every URL', () => {
    const urls = snap.tabs.map((t) => t.url);
    for (const w of ['a1', 'a2', 'a3', 'b1', 'b2']) assert.ok(urls.includes(url(w)), `${w} captured`);
  });

  // Clicking a sleeping tab wakes it. A click also brings its window to the
  // front; Brave only reloads a discarded tab once it is actually visible.
  await browser.evalSW(`
    await chrome.windows.update(${state.a2.windowId}, { focused: true });
    await chrome.tabs.update(${state.a2.id}, { active: true });`);
  const woken = await eventually(async () => {
    const s = await byUrl();
    assert.equal(s.a2.discarded, false);
    assert.equal(s.a2.title, 'Example Domain');
    return s;
  });
  check('a sleeping tab wakes up when opened', () => assert.equal(woken.a2.active, true));

  for (const [name, fn] of checks) {
    try { fn(); console.log(`  ✓ ${name}`); } catch (e) { failed++; console.log(`  ✘ ${name}\n    ${e.message}`); }
  }
} catch (e) {
  failed++;
  console.log(`  ✘ setup failed\n    ${e.stack}`);
} finally {
  await browser.close();
}
console.log(failed ? `\n${failed} failed` : `\n${checks.length} passed`);
process.exit(failed ? 1 : 0);
