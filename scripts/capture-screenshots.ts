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
import { buildDemoSessions, demoSettings } from './demo-data';

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

async function clearAll(sw: Awaited<ReturnType<typeof getServiceWorker>>) {
  await sw.evaluate(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();
  });
}

// Keep the one-time rating banner out of store screenshots.
const NO_RATING_BANNER = { [KEYS.meta]: { statsBackfilled: true, ratingPromptDone: true, stats: {} } };

async function waitForPopupReady(page: import('@playwright/test').Page) {
  await page.waitForSelector('.popup', { state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('.loader'), { timeout: 10_000 });
  // Park the mouse in the header's top-left corner, which has no hover styles
  // (the bottom-right corner lands on a card), so nothing is captured in its
  // hover state (the previous step's click leaves it over a card).
  await page.mouse.move(4, 4);
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
  
  const seedDemo = async (sessions = demoSessions) => {
    await clearAll(sw);
    await seedLocal(sw, {
      [KEYS.sessions]: sessions,
      [KEYS.settings]: demoSettings,
      ...NO_RATING_BANNER,
    });
  };

  // Gallery order follows the ASO plan (docs/growth/aso-2026-11-18.md, D17):
  // outcome, how it works, tab groups, safety nets, search.

  // ── 1. Outcome: the session list, each card with its Restore button ──
  console.log('[capture] 1/5 sessions with Restore');
  await seedDemo();
  await popup.goto(popupUrl);
  await waitForPopupReady(popup);
  await popup.screenshot({ path: path.join(RAW_DIR, '1-restore.png') });

  // ── 2. How it works: the guide's three steps (welcome page, help version) ──
  console.log('[capture] 2/5 how it works');
  const guide = await context.newPage();
  await guide.setViewportSize({ width: 400, height: 600 });
  await guide.goto(`chrome-extension://${extensionId}/welcome.html?from=help`);
  await guide.waitForSelector('[data-step="how"]');
  await guide.evaluate(() => {
    const heading = document.querySelector('h1') as HTMLElement;
    window.scrollTo(0, heading.getBoundingClientRect().top + window.scrollY - 12);
  });
  await guide.waitForTimeout(300);
  await guide.screenshot({ path: path.join(RAW_DIR, '2-how-it-works.png') });
  await guide.close();

  // ── 3. Tab groups: Project Phoenix detail with two coloured groups ──
  console.log('[capture] 3/5 tab groups');
  await popup.bringToFront();
  await popup.goto(popupUrl);
  await waitForPopupReady(popup);
  await popup.locator('.card').filter({ hasText: 'Project Phoenix' }).click();
  await popup.waitForSelector('.detail', { state: 'visible' });
  // The click leaves the mouse over a tab row of the detail view.
  await popup.mouse.move(4, 4);
  await popup.waitForTimeout(250);
  await popup.screenshot({ path: path.join(RAW_DIR, '3-tab-groups.png') });

  // ── 4. Safety nets: the three kinds of automatic save in the list ──
  console.log('[capture] 4/5 safety nets');
  const safetyIds = ['demo-backup', 'demo-closed-group', 'demo-browser-close'];
  await seedDemo(demoSessions.filter((s) => safetyIds.includes(s.id)));
  await popup.goto(popupUrl);
  await waitForPopupReady(popup);
  await popup.screenshot({ path: path.join(RAW_DIR, '4-safety-nets.png') });

  // ── 5. Search: matches across every saved session ──
  console.log('[capture] 5/5 search');
  await seedDemo();
  await popup.goto(popupUrl);
  await waitForPopupReady(popup);
  await popup.locator('input[placeholder^="Search"]').fill('phoenix');
  await popup.waitForTimeout(300);
  await popup.screenshot({ path: path.join(RAW_DIR, '5-search.png') });

  await context.close();
  console.log(`[capture] Done. Raw PNGs in ${path.relative(ROOT, RAW_DIR)}/`);
}

main().catch((e) => {
  console.error('[capture] Failed:', e);
  process.exit(1);
});
