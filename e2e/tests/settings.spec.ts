import { test, expect } from '../fixtures/extension';
import { reloadPopup } from '../fixtures/extension';
import { seedSessions, createMockSession } from '../helpers/storage';

test.describe('Settings', () => {
  test('navigating to settings view', async ({ popupPage }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();
    await expect(popupPage.locator('.settings')).toBeVisible();
    await expect(popupPage.locator('.settings-header h2')).toHaveText('Settings');
  });

  test('back button returns to main view', async ({ popupPage }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();
    await popupPage.locator('button[aria-label="Back"]').click();
    await expect(popupPage.locator('.header')).toBeVisible();
    await expect(popupPage.locator('.settings')).not.toBeVisible();
  });

  const row = (page: import('@playwright/test').Page, title: string) =>
    page.locator('.setting-row').filter({ has: page.locator('.setting-title', { hasText: title }) });

  test('four sections plus Help, in order (D21)', async ({ popupPage }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();
    await expect(popupPage.locator('.section-label')).toHaveText([
      'Save automatically', 'Saving', 'Restoring', 'Storage & data', 'Help',
    ]);
    await expect(popupPage.locator('.section-caption')).toHaveText('Off by default. Everything stays on this device.');
  });

  test('every working setting is there, and the dead incognito-warning toggle is gone (D20)', async ({ popupPage }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();
    for (const title of [
      'When I quit the browser', 'When I close a tab group', 'Rolling backup',
      'Ask before saving a duplicate', 'Never save these sites',
      'Open in a new window', 'Sleep restored tabs', 'Delete a session after restoring it', 'Keep up to',
    ]) {
      await expect(popupPage.locator('.setting-title', { hasText: title })).toBeVisible();
    }
    await expect(popupPage.getByText('Incognito save warning')).toHaveCount(0);
  });

  test('incognito rows are hidden without incognito access (D24)', async ({ popupPage }) => {
    // Playwright's extension isn't allowed in incognito.
    expect(await popupPage.evaluate(() => chrome.extension.isAllowedIncognitoAccess())).toBe(false);
    await popupPage.locator('button[aria-label="Settings"]').click();
    await expect(popupPage.locator('.setting-title', { hasText: 'Sleep restored tabs' })).toBeVisible();
    await expect(popupPage.getByText('When I close an incognito window')).toHaveCount(0);
    await expect(popupPage.getByText('Incognito tabs open in an incognito window')).toHaveCount(0);
  });

  test('toggle switches are interactive', async ({ popupPage }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();
    const toggle = row(popupPage, 'Delete a session after restoring it').locator('.tv-switch');
    await expect(toggle).not.toBeChecked();
    await toggle.click();
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();
  });

  test('max sessions input accepts values', async ({ popupPage }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();
    const input = popupPage.getByLabel('Maximum number of sessions');
    await expect(input).toHaveValue('50');

    await input.fill('100');
    await input.press('Tab');
    await expect(input).toHaveValue('100');
  });

  test('storage usage line and bar are visible', async ({ popupPage }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();
    await expect(popupPage.locator('.storage-val')).toContainText('of 10 MB used');
    await expect(popupPage.getByRole('meter', { name: 'Storage used' })).toBeVisible();
  });

  test('"Delete all sessions…" asks once, naming the count', async ({ popupPage, context, extensionId }) => {
    await seedSessions(context, [createMockSession({ id: 'a' }), createMockSession({ id: 'b' })]);
    await reloadPopup(popupPage, extensionId);

    await popupPage.locator('button[aria-label="Settings"]').click();
    const dangerBtn = popupPage.locator('.danger-btn');

    await expect(dangerBtn).toHaveText('Delete all sessions…');

    // First click asks for confirmation
    await dangerBtn.click();
    await expect(dangerBtn).toHaveText('Click again to delete 2 sessions');
    await expect(dangerBtn).toHaveClass(/danger-active/);

    // Second click confirms
    await dangerBtn.click();
    await expect(popupPage.locator('.toast-text')).toHaveText('All sessions deleted');
  });

  test('"Delete all sessions…" is disabled when there is nothing to delete', async ({ popupPage }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();
    await expect(popupPage.locator('.danger-btn')).toBeDisabled();
  });

  test('Help links and the version footer', async ({ popupPage }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();
    await expect(popupPage.getByTestId('guide-link')).toHaveText('How to use SnapTabs');
    await expect(popupPage.getByTestId('issues-link')).toHaveAttribute('href', 'https://github.com/threatner/SnapTabs/issues');
    await expect(popupPage.locator('.settings-footer')).toHaveText(/^SnapTabs \d+\.\d+\.\d+$/);
  });

  test('settings persist across popup reloads', async ({ popupPage, extensionId }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();

    const toggle = () => row(popupPage, 'Delete a session after restoring it').locator('.tv-switch');
    await toggle().click();
    await expect(toggle()).toBeChecked();

    await reloadPopup(popupPage, extensionId);

    await popupPage.locator('button[aria-label="Settings"]').click();
    await expect(toggle()).toBeChecked();
  });

  test('rolling backup: picking an interval saves a Backup session right away', async ({ context, popupPage, extensionId }) => {
    const site = await context.newPage();
    await site.goto('https://example.com/?snaptabs=backup-e2e');

    await popupPage.locator('button[aria-label="Settings"]').click();
    const select = popupPage.locator('select[aria-label="Rolling backup interval"]');
    await expect(select).toHaveValue('0');
    await select.selectOption({ label: 'Every 15 min' });

    await expect(async () => {
      await reloadPopup(popupPage, extensionId);
      const card = popupPage.locator('.card').filter({ hasText: 'Rolling backup' });
      await expect(card).toHaveCount(1, { timeout: 500 });
      await expect(card.locator('.badge')).toHaveText('Backup');
    }).toPass({ timeout: 10_000 });

    await popupPage.locator('button[aria-label="Settings"]').click();
    await expect(popupPage.locator('select[aria-label="Rolling backup interval"]')).toHaveValue('15');
    await site.close();
  });

  test('sleep restored tabs toggle is in Restoring and persists', async ({ popupPage, extensionId }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();
    const row = popupPage.locator('.setting-row').filter({ hasText: 'Sleep restored tabs' });
    const toggle = row.locator('.tv-switch');
    // The E2E baseline turns sleeping off (see E2E_BASE_SETTINGS).
    await expect(toggle).not.toBeChecked();
    await toggle.click();
    await expect(toggle).toBeChecked();

    await reloadPopup(popupPage, extensionId);
    await popupPage.locator('button[aria-label="Settings"]').click();
    await expect(popupPage.locator('.setting-row').filter({ hasText: 'Sleep restored tabs' }).locator('.tv-switch')).toBeChecked();
  });

  test('"When I close a tab group" is in Save automatically, off by default, and persists', async ({ popupPage, extensionId }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();
    const toggle = row(popupPage, 'When I close a tab group').locator('.tv-switch');
    await expect(toggle).not.toBeChecked();
    await toggle.click();
    await reloadPopup(popupPage, extensionId);
    await popupPage.locator('button[aria-label="Settings"]').click();
    await expect(row(popupPage, 'When I close a tab group').locator('.tv-switch')).toBeChecked();
  });
});

