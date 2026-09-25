// Minimal raw Chrome DevTools Protocol harness for checks Playwright can't do:
// Playwright loses its browser connection when a tab is discarded, so tab
// sleeping is verified here instead. Launches the Playwright-bundled Chromium
// with the built extension and evaluates code in extension contexts.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const DEFAULT_EXT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.output', 'chrome-mv3');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Every CDP round trip gets a deadline so a dead target fails the check
// instead of hanging the run.
const CDP_TIMEOUT_MS = 30_000;
function withTimeout(promise, what) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`CDP timeout: ${what}`)), CDP_TIMEOUT_MS); }),
  ]);
}

// Pass `userDataDir` to reuse a profile across launches (it is then kept on close).
// A leftover browser on the same debugging port would silently answer in
// place of ours, so only use a port nothing is listening on.
async function freePort() {
  for (let i = 0; i < 20; i++) {
    const port = 9300 + Math.floor(Math.random() * 500);
    try { await fetch(`http://127.0.0.1:${port}/json/version`); } catch { return port; }
  }
  throw new Error('no free debugging port');
}

export async function launch({ port, ext = DEFAULT_EXT, userDataDir } = {}) {
  port ??= await freePort();
  const dir = userDataDir ?? mkdtempSync(path.join(tmpdir(), 'snaptabs-cdp-'));
  const proc = spawn(process.env.BROWSER_PATH || chromium.executablePath(), [
    `--user-data-dir=${dir}`, `--remote-debugging-port=${port}`,
    `--disable-extensions-except=${ext}`, `--load-extension=${ext}`,
    '--no-first-run', '--no-default-browser-check', '--disable-sync',
    // As Playwright does: CI Linux runners block Chrome's sandbox.
    '--no-sandbox',
    'about:blank',
  ], { stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;

  async function targets() {
    for (let i = 0; i < 100; i++) {
      try { return await (await fetch(`${base}/json/list`)).json(); } catch { await sleep(100); }
    }
    throw new Error('DevTools endpoint never came up');
  }

  async function waitForTarget(match) {
    for (let i = 0; i < 100; i++) {
      const t = (await targets()).find(match);
      if (t) return t;
      await sleep(100);
    }
    throw new Error('target not found');
  }

  /** Send a raw CDP command to the browser target. */
  async function browserCommand(method, params = {}) {
    const { webSocketDebuggerUrl } = await (await fetch(`${base}/json/version`)).json();
    const ws = new WebSocket(webSocketDebuggerUrl);
    let res;
    try {
      res = await withTimeout((async () => {
        await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
        return new Promise((resolve) => {
          ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id === 1) resolve(d); };
          ws.send(JSON.stringify({ id: 1, method, params }));
        });
      })(), method);
    } finally {
      ws.close();
    }
    if (res.error) throw new Error(res.error.message);
    return res.result;
  }

  async function evaluate(target, body) {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let res;
    try {
      res = await withTimeout((async () => {
        await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
        return new Promise((resolve) => {
          ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id === 1) resolve(d); };
          ws.onclose = () => resolve({ result: { exceptionDetails: { exception: { description: 'target closed during evaluate' } } } });
          ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: {
            expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true,
          } }));
        });
      })(), `evaluate in ${target.url}`);
    } finally {
      ws.close();
    }
    if (res.result?.exceptionDetails) throw new Error(res.result.exceptionDetails.exception?.description ?? 'evaluate failed');
    return res.result?.result?.value;
  }

  const sw = () => waitForTarget((t) => t.type === 'service_worker' && t.url.endsWith('/background.js'));
  const extensionId = (await sw()).url.split('/')[2];

  // The worker target can be listed before it answers (seen on Brave's first
  // start); wait until it evaluates.
  for (let i = 0; ; i++) {
    try {
      await Promise.race([evaluate(await sw(), 'return 1'), sleep(3_000).then(() => { throw new Error('slow'); })]);
      break;
    } catch (e) {
      if (i >= 20) throw new Error(`service worker never became ready: ${e.message}`);
      await sleep(250);
    }
  }

  return {
    extensionId,
    targets,
    waitForTarget,
    browserCommand,
    /** Evaluate an async function body in the extension service worker. */
    evalSW: async (body) => evaluate(await sw(), body),
    /** Open an extension page in a tab and return an evaluator for it. */
    async openExtensionPage(page) {
      const url = `chrome-extension://${extensionId}/${page}`;
      await fetch(`${base}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
      const target = await waitForTarget((t) => t.type === 'page' && t.url === url);
      return (body) => evaluate(target, body);
    },
    /** Quit the browser gracefully so the profile is flushed to disk. */
    async close() {
      const exited = new Promise((resolve) => proc.once('exit', resolve));
      proc.kill('SIGTERM');
      await Promise.race([exited, sleep(10_000)]);
      if (!userDataDir) try { rmSync(dir, { recursive: true, force: true }); } catch {}
    },
  };
}

/** Poll `fn` until it stops throwing, like Playwright's toPass. */
export async function eventually(fn, timeoutMs = 20_000) {
  const start = Date.now();
  for (;;) {
    try { return await fn(); } catch (e) {
      if (Date.now() - start > timeoutMs) throw e;
      await sleep(250);
    }
  }
}
