import { test, expect } from '../fixtures/extension';
import type { Page } from '@playwright/test';
import { seedSettings, getServiceWorker } from '../helpers/storage';
import { KEYS } from '../../src/lib/storage';

// The fixture already asserts the welcome page opens on install (and closes
// it). These tests open it again to exercise the page itself.
async function openWelcome(page: Page, extensionId: string) {
  await page.goto(`chrome-extension://${extensionId}/welcome.html`);
  await expect(page.locator('h1')).toHaveText('SnapTabs is installed');
  // Toggles are disabled until stored settings have loaded.
  await expect(page.getByLabel('Save my tabs when I close the browser')).toBeEnabled();
}

async function storedSettings(page: Page) {
  return page.evaluate(async (key) => (await chrome.storage.local.get(key))[key], KEYS.settings);
}

test.describe('Welcome page', () => {
  test('shows the two steps, with both safety options off by default', async ({ popupPage, extensionId }) => {
    await openWelcome(popupPage, extensionId);
    await expect(popupPage.locator('.step')).toHaveCount(2);
    await expect(popupPage.getByLabel('Save my tabs when I close the browser')).not.toBeChecked();
    await expect(popupPage.getByLabel('Keep a rolling backup')).not.toBeChecked();
  });

  test('explains how to pin, showing the extensions and pin icons', async ({ popupPage, extensionId }) => {
    await openWelcome(popupPage, extensionId);
    const pin = popupPage.locator('[data-step="pin"]');
    await expect(pin.getByRole('img', { name: 'extensions (puzzle piece) icon' })).toBeVisible();
    await expect(pin.getByRole('img', { name: 'pin icon' })).toBeVisible();
  });

  test('turning on save-on-close writes the setting', async ({ popupPage, extensionId }) => {
    await openWelcome(popupPage, extensionId);
    await popupPage.getByLabel('Save my tabs when I close the browser').click();
    await expect.poll(async () => (await storedSettings(popupPage)).autoSnapshotOnBrowserClose).toBe(true);
  });

  test('turning on rolling backup sets a 15 minute interval and takes a backup', async ({ context, popupPage, extensionId }) => {
    const site = await context.newPage();
    await site.goto('https://example.com/?snaptabs=welcome');
    await openWelcome(popupPage, extensionId);

    await popupPage.getByLabel('Keep a rolling backup').click();
    await expect.poll(async () => (await storedSettings(popupPage)).autoBackupMinutes).toBe(15);

    const sw = await getServiceWorker(context);
    await expect.poll(async () => sw.evaluate(async (key) => {
      const sessions = (await chrome.storage.local.get(key))[key] ?? [];
      return sessions.filter((s: { isBackup?: boolean }) => s.isBackup).length;
    }, KEYS.sessions)).toBe(1);

    await popupPage.getByLabel('Keep a rolling backup').click();
    await expect.poll(async () => (await storedSettings(popupPage)).autoBackupMinutes).toBe(0);
    await site.close();
  });

  test('toggling both options quickly keeps both', async ({ popupPage, extensionId }) => {
    await openWelcome(popupPage, extensionId);
    await popupPage.getByLabel('Save my tabs when I close the browser').click();
    await popupPage.getByLabel('Keep a rolling backup').click();
    await expect.poll(async () => {
      const s = await storedSettings(popupPage);
      return [s.autoSnapshotOnBrowserClose, s.autoBackupMinutes];
    }).toEqual([true, 15]);
  });

  test('reflects settings that are already on', async ({ context, popupPage, extensionId }) => {
    await seedSettings(context, { autoSnapshotOnBrowserClose: true, autoBackupMinutes: 30 });
    await openWelcome(popupPage, extensionId);
    await expect(popupPage.getByLabel('Save my tabs when I close the browser')).toBeChecked();
    await expect(popupPage.getByLabel('Keep a rolling backup')).toBeChecked();
  });

  test('Done closes the tab', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await openWelcome(page, extensionId);
    const closed = page.waitForEvent('close');
    await page.getByRole('button', { name: 'Done' }).click();
    await closed;
    expect(page.isClosed()).toBe(true);
  });
});
