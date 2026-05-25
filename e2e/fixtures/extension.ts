import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { getServiceWorker } from '../helpers/storage';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '..', '..', '.output', 'chrome-mv3');

export type ExtensionFixtures = {
  context: BrowserContext;
  extensionId: string;
  popupPage: Page;
};

/** Wait for Svelte to mount and the loading spinner to disappear. */
export async function waitForPopupReady(page: Page) {
  await page.waitForSelector('.popup', { state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('.loader'), { timeout: 10_000 });
}

/** Navigate to popup.html and wait for it to be ready. */
export async function reloadPopup(page: Page, extensionId: string) {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await waitForPopupReady(page);
}

/** Open the context menu on the first session card. */
export async function openCardContextMenu(page: Page) {
  await page.locator('.card').first().hover();
  await page.locator('.action-btn').first().click();
}

// Resolve the browser binary path. Reads from the active Playwright
// project's metadata.executablePath (e.g. the `brave` project), with env
// overrides for ad-hoc runs. Defaults to bundled Chromium when unset.
function resolveExecutablePath(metadataPath: unknown): string | undefined {
  if (process.env.BROWSER_PATH) return process.env.BROWSER_PATH;
  if (process.env.BRAVE_PATH) return process.env.BRAVE_PATH;
  if (typeof metadataPath === 'string' && metadataPath.length > 0) return metadataPath;
  return undefined;
}

export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use, testInfo) => {
    const executablePath = resolveExecutablePath(testInfo.project.metadata?.executablePath);
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      ...(executablePath ? { executablePath } : {}),
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
    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    const sw = await getServiceWorker(context);
    const extensionId = sw.url().split('/')[2];
    await use(extensionId);
  },

  popupPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await reloadPopup(page, extensionId);
    await use(page);
    await page.close();
  },
});

export { expect } from '@playwright/test';
