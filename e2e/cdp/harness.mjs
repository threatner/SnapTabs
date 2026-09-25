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

const EXT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.output', 'chrome-mv3');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ port = 9300 + Math.floor(Math.random() * 500) } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'snaptabs-cdp-'));
  const proc = spawn(process.env.BROWSER_PATH || chromium.executablePath(), [
    `--user-data-dir=${dir}`, `--remote-debugging-port=${port}`,
    `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`,
    '--no-first-run', '--no-default-browser-check', '--disable-sync', 'about:blank',
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

  async function evaluate(target, body) {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    const res = await new Promise((resolve) => {
      ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id === 1) resolve(d); };
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: {
        expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true,
      } }));
    });
    ws.close();
    if (res.result?.exceptionDetails) throw new Error(res.result.exceptionDetails.exception?.description ?? 'evaluate failed');
    return res.result?.result?.value;
  }

  const sw = () => waitForTarget((t) => t.type === 'service_worker' && t.url.endsWith('/background.js'));
  const extensionId = (await sw()).url.split('/')[2];

  return {
    extensionId,
    targets,
    waitForTarget,
    /** Evaluate an async function body in the extension service worker. */
    evalSW: async (body) => evaluate(await sw(), body),
    /** Open an extension page in a tab and return an evaluator for it. */
    async openExtensionPage(page) {
      const url = `chrome-extension://${extensionId}/${page}`;
      await fetch(`${base}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
      const target = await waitForTarget((t) => t.type === 'page' && t.url === url);
      return (body) => evaluate(target, body);
    },
    close() {
      proc.kill();
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
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
