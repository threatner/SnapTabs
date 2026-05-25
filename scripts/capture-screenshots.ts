// Capture raw 400x600 popup screenshots for the Chrome Web Store listing.
// Launches the built extension in a real Chromium instance, seeds realistic
// demo data, navigates to each view, and writes PNGs into screenshots/store/raw/.
//
// Run via: npm run screenshots:capture (or npm run screenshots for the full pipeline)

import { chromium, type BrowserContext } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { KEYS } from '../src/lib/storage';
import { buildDemoSessions, demoSettings, buildDemoRecording } from './demo-data';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXTENSION_PATH = path.join(ROOT, '.output', 'chrome-mv3');
const RAW_DIR = path.join(ROOT, 'screenshots', 'store', 'raw');

async function getServiceWorker(context: BrowserContext) {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker');
  return sw;
}

async function seedLocal(sw: Awaited<ReturnType<typeof getServiceWorker>>, data: Record<string, unknown>) {
  await sw.evaluate((d) => chrome.storage.local.set(d), data);
}

async function seedSession(sw: Awaited<ReturnType<typeof getServiceWorker>>, data: Record<string, unknown>) {
  await sw.evaluate((d) => chrome.storage.session.set(d), data);
}

async function clearAll(sw: Awaited<ReturnType<typeof getServiceWorker>>) {
  await sw.evaluate(() => {
    chrome.storage.local.clear();
    chrome.storage.session.clear();
  });
}

async function waitForPopupReady(page: import('@playwright/test').Page) {
  await page.waitForSelector('.popup', { state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('.loader'), { timeout: 10_000 });
  // Small settle pause so animations land before screenshot
  await page.waitForTimeout(250);
}

async function main() {
  if (!fs.existsSync(EXTENSION_PATH)) {
    console.error(`[capture] No build found at ${EXTENSION_PATH}. Run 'npm run build' first.`);
    process.exit(1);
  }
  fs.mkdirSync(RAW_DIR, { recursive: true });

  console.log('[capture] Launching extension...');
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--disable-default-apps',
      '--disable-popup-blocking',
      '--disable-translate',
      '--disable-sync',
    ],
  });

  const sw = await getServiceWorker(context);
  const extensionId = sw.url().split('/')[2];
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  console.log(`[capture] Extension loaded as ${extensionId}`);

  const popup = await context.newPage();
  await popup.setViewportSize({ width: 400, height: 600 });

  const demoSessions = buildDemoSessions();
  const demoRecording = buildDemoRecording();

  // ── 1. Main view: rich session list (8 sessions, pinned at top) ──
  console.log('[capture] 1/4 main view');
  await clearAll(sw);
  await seedLocal(sw, {
    [KEYS.sessions]: demoSessions,
    [KEYS.settings]: demoSettings,
  });
  await popup.goto(popupUrl);
  await waitForPopupReady(popup);
  await popup.screenshot({ path: path.join(RAW_DIR, '1-main.png') });

  // ── 2. Session detail: Phoenix, two tab groups visible ──
  console.log('[capture] 2/4 session detail');
  await popup.locator('.card').first().click();
  await popup.waitForSelector('.detail', { state: 'visible' });
  await popup.waitForTimeout(250);
  await popup.screenshot({ path: path.join(RAW_DIR, '2-detail.png') });

  // ── 3. Recording in progress: bar visible with elapsed timer ──
  console.log('[capture] 3/4 recording');
  await clearAll(sw);
  await seedLocal(sw, {
    [KEYS.sessions]: demoSessions,
    [KEYS.settings]: demoSettings,
  });
  await seedSession(sw, {
    [KEYS.recording]: demoRecording,
  });
  await popup.goto(popupUrl);
  await waitForPopupReady(popup);
  // RecordingBar should render because getRecording() returns isActive:true
  await popup.screenshot({ path: path.join(RAW_DIR, '3-recording.png') });

  // ── 4. Settings: scrolled to the Snapshot section so excluded-domain chips are visible ──
  console.log('[capture] 4/4 settings');
  await clearAll(sw);
  await seedLocal(sw, {
    [KEYS.sessions]: demoSessions,
    [KEYS.settings]: demoSettings,
  });
  await popup.goto(popupUrl);
  await waitForPopupReady(popup);
  await popup.locator('button[aria-label="Settings"]').click();
  await popup.waitForSelector('.settings-body', { state: 'visible' });
  await popup.waitForTimeout(150);
  // Scroll the settings body so Snapshot + Excluded domains are centered in view
  await popup.evaluate(() => {
    const body = document.querySelector('.settings-body') as HTMLElement | null;
    const target = Array.from(document.querySelectorAll('.section-label')).find(
      (el) => (el.textContent ?? '').trim() === 'Snapshot',
    ) as HTMLElement | undefined;
    if (body && target) {
      body.scrollTop = target.offsetTop - 8;
    }
  });
  await popup.waitForTimeout(250);
  await popup.screenshot({ path: path.join(RAW_DIR, '4-settings.png') });

  await context.close();
  console.log(`[capture] Done. Raw PNGs in ${path.relative(ROOT, RAW_DIR)}/`);
}

main().catch((e) => {
  console.error('[capture] Failed:', e);
  process.exit(1);
});
