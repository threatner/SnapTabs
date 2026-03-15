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

export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
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
