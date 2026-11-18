// Real-browser check: showing saved sessions makes no network requests
// (D14, docs/v1.10-growth/spec.md R1). The browser runs through a local proxy
// that logs every connection; favicons must come from Chrome's local cache.
import assert from 'node:assert/strict';
import http from 'node:http';
import { launch, sleep, eventually } from './harness.mjs';

const seen = [];
const proxy = http.createServer((req, res) => { seen.push(new URL(req.url).host); res.writeHead(502).end(); });
proxy.on('connect', (req, socket) => { seen.push(req.url.split(':')[0]); socket.destroy(); });
await new Promise((r) => proxy.listen(0, '127.0.0.1', r));
const proxyPort = proxy.address().port;

// Hosts nobody else would contact: any hit means SnapTabs asked for them.
// (Chrome itself talks to www.google.com / accounts.google.com in the
// background whether or not SnapTabs does anything, so Google hosts are no
// signal; the old Google-favicon path is caught by the src check below.)
const PROBE = ['snaptabs-probe-a.example', 'snaptabs-probe-b.example'];
const tab = (host, i) => ({
  url: `https://${host}/page`, title: host, pinned: false, isIncognito: false, index: i,
  favIconUrl: `https://${host}/favicon.ico`,
});

let failed = 0;
const b = await launch({ args: [`--proxy-server=http://127.0.0.1:${proxyPort}`] });
try {
  await b.evalSW(`await chrome.storage.local.set({ snaptabs_sessions: [{ id: 'net', name: 'No network', timestamp: Date.now(),
    tabs: ${JSON.stringify(PROBE.map(tab))}, tabGroups: [], windowCount: 1, hasIncognitoTabs: false, isAutoSave: false }] });`);
  const popup = await b.openExtensionPage('popup.html');
  await sleep(500);
  seen.length = 0;
  await popup(`document.querySelector('.card').click(); return 1;`);
  const icons = await eventually(async () => {
    const r = await popup(`return [...document.querySelectorAll('.detail img')].map((i) => ({ src: i.src, ok: i.complete && i.naturalWidth > 0 }));`);
    assert.equal(r.length, PROBE.length);
    assert.ok(r.every((i) => i.ok), 'favicons rendered');
    return r;
  });
  await sleep(1500);
  const leaked = seen.filter((h) => PROBE.includes(h));
  assert.ok(icons.every((i) => i.src.startsWith('chrome-extension://') && i.src.includes('/_favicon/')), 'favicons use the local cache');
  assert.deepEqual(leaked, [], `requests left the browser: ${leaked.join(', ')}`);
  console.log(`  ✓ session details show favicons from the local cache with no network requests (${icons.length} icons, 0 requests to the saved sites)`);
} catch (e) {
  failed++;
  console.log(`  ✘ ${e.message}`);
} finally {
  await b.close();
  proxy.close();
}
console.log(failed ? '\n1 failed' : '\n1 passed');
process.exit(failed ? 1 : 0);
