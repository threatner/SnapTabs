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
  await expect(page.getByLabel('When I quit the browser')).toBeEnabled();
}

async function storedSettings(page: Page) {
  return page.evaluate(async (key) => (await chrome.storage.local.get(key))[key], KEYS.settings);
}

test.describe('Welcome page', () => {
  test('shows the two steps, with both safety options off by default', async ({ popupPage, extensionId }) => {
    await openWelcome(popupPage, extensionId);
    await expect(popupPage.locator('.step')).toHaveCount(2);
    await expect(popupPage.getByLabel('When I quit the browser')).not.toBeChecked();
    await expect(popupPage.getByLabel('Rolling backup every 15 minutes')).not.toBeChecked();
  });

  test('says it is open source and links to GitHub (D26)', async ({ popupPage, extensionId }) => {
    await openWelcome(popupPage, extensionId);
    const gh = popupPage.getByRole('link', { name: 'Free and open source. View SnapTabs on GitHub' });
    await expect(gh).toBeVisible();
    await expect(gh).toHaveAttribute('href', 'https://github.com/threatner/SnapTabs');
  });

  test('explains how to pin, showing the extensions and pin icons', async ({ popupPage, extensionId }) => {
    await openWelcome(popupPage, extensionId);
    const pin = popupPage.locator('[data-step="pin"]');
    await expect(pin.getByRole('img', { name: 'extensions (puzzle piece) icon' })).toBeVisible();
    await expect(pin.getByRole('img', { name: 'pin icon' })).toBeVisible();
  });

  test('turning on save-on-close writes the setting', async ({ popupPage, extensionId }) => {
    await openWelcome(popupPage, extensionId);
    await popupPage.getByLabel('When I quit the browser').click();
    await expect.poll(async () => (await storedSettings(popupPage)).autoSnapshotOnBrowserClose).toBe(true);
  });

  test('turning on rolling backup sets a 15 minute interval and takes a backup', async ({ context, popupPage, extensionId }) => {
    const site = await context.newPage();
    await site.goto('https://example.com/?snaptabs=welcome');
    await openWelcome(popupPage, extensionId);

    await popupPage.getByLabel('Rolling backup every 15 minutes').click();
    await expect.poll(async () => (await storedSettings(popupPage)).autoBackupMinutes).toBe(15);

    const sw = await getServiceWorker(context);
    await expect.poll(async () => sw.evaluate(async (key) => {
      const sessions = (await chrome.storage.local.get(key))[key] ?? [];
      return sessions.filter((s: { isBackup?: boolean }) => s.isBackup).length;
    }, KEYS.sessions)).toBe(1);

    await popupPage.getByLabel('Rolling backup every 15 minutes').click();
    await expect.poll(async () => (await storedSettings(popupPage)).autoBackupMinutes).toBe(0);
    await site.close();
  });

  test('toggling both options quickly keeps both', async ({ popupPage, extensionId }) => {
    await openWelcome(popupPage, extensionId);
    await popupPage.getByLabel('When I quit the browser').click();
    await popupPage.getByLabel('Rolling backup every 15 minutes').click();
    await expect.poll(async () => {
      const s = await storedSettings(popupPage);
      return [s.autoSnapshotOnBrowserClose, s.autoBackupMinutes];
    }).toEqual([true, 15]);
  });

  test('reflects settings that are already on', async ({ context, popupPage, extensionId }) => {
    await seedSettings(context, { autoSnapshotOnBrowserClose: true, autoBackupMinutes: 30 });
    await openWelcome(popupPage, extensionId);
    await expect(popupPage.getByLabel('When I quit the browser')).toBeChecked();
    await expect(popupPage.getByLabel('Rolling backup every 15 minutes')).toBeChecked();
  });

  test('Done closes the tab', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await openWelcome(page, extensionId);
    const closed = page.waitForEvent('close');
    await page.getByRole('button', { name: 'Done' }).click();
    await closed;
    expect(page.isClosed()).toBe(true);
  });

  test('explains how SnapTabs works in three steps, above the setup steps', async ({ popupPage, extensionId }) => {
    await openWelcome(popupPage, extensionId);
    const how = popupPage.locator('[data-step="how"]');
    await expect(how.locator('h2')).toHaveText('How SnapTabs works');
    await expect(how.locator('.how-title')).toHaveText(['Save your tabs', 'Close them', 'Bring them back']);
    await expect(how.locator('.rep-primary')).toContainText('Snapshot');
    await expect(how.locator('.rep-secondary')).toContainText('Restore');
    // The guide comes before the pin and auto-save steps.
    const howBox = await how.boundingBox();
    const pinBox = await popupPage.locator('[data-step="pin"]').boundingBox();
    expect(howBox!.y).toBeLessThan(pinBox!.y);
  });

  test('opened from help, it reads as a guide and keeps the same content', async ({ popupPage, extensionId }) => {
    await popupPage.goto(`chrome-extension://${extensionId}/welcome.html?from=help`);
    await expect(popupPage.locator('h1')).toHaveText('How to use SnapTabs');
    await expect(popupPage.locator('[data-step="how"] .how-title')).toHaveCount(3);
    await expect(popupPage.locator('.step')).toHaveCount(2);
  });
});

test.describe('Help entry points', () => {
  async function openedGuide(context: import('@playwright/test').BrowserContext, extensionId: string) {
    const url = `chrome-extension://${extensionId}/welcome.html?from=help`;
    await expect.poll(() => context.pages().some((p) => p.url() === url)).toBe(true);
    const page = context.pages().find((p) => p.url() === url)!;
    await expect(page.locator('h1')).toHaveText('How to use SnapTabs');
  }

  test('the ? button in the popup header opens the guide', async ({ context, popupPage, extensionId }) => {
    const help = popupPage.getByRole('link', { name: 'How to use SnapTabs' });
    await expect(help).toBeVisible();
    await help.click();
    await openedGuide(context, extensionId);
  });

  test('Settings has a "How to use SnapTabs" card that opens the guide', async ({ context, popupPage, extensionId }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();
    await expect(popupPage.locator('.section-label').filter({ hasText: 'Help' })).toBeVisible();
    await popupPage.getByTestId('guide-link').click();
    await openedGuide(context, extensionId);
  });

  test('turning on "When I close a tab group" writes the setting', async ({ popupPage, extensionId }) => {
    await openWelcome(popupPage, extensionId);
    const toggle = popupPage.getByLabel('When I close a tab group');
    await expect(toggle).not.toBeChecked();
    await toggle.click();
    await expect.poll(async () => (await storedSettings(popupPage)).saveClosedGroups).toBe(true);
  });
});

