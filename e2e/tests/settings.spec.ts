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

  test('all setting sections are visible', async ({ popupPage }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();
    await expect(popupPage.locator('.section-label').filter({ hasText: 'Auto-Save' })).toBeVisible();
    await expect(popupPage.locator('.section-label').filter({ hasText: 'Restore' })).toBeVisible();
    await expect(popupPage.locator('.section-label').filter({ hasText: 'Warnings' })).toBeVisible();
    await expect(popupPage.locator('.section-label').filter({ hasText: 'Storage' })).toBeVisible();
  });

  test('toggle switches are interactive', async ({ popupPage }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();

    // Auto-delete after restore toggle (second toggle)
    const toggle = popupPage.locator('.tv-switch').nth(1);
    await expect(toggle).not.toBeChecked();
    await toggle.click();
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();
  });

  test('max sessions input accepts values', async ({ popupPage }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();
    const input = popupPage.locator('.num-input');
    await expect(input).toHaveValue('50');

    await input.fill('100');
    await input.press('Tab');
    await expect(input).toHaveValue('100');
  });

  test('storage usage bar is visible', async ({ popupPage }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();
    await expect(popupPage.locator('.storage-card')).toBeVisible();
    await expect(popupPage.locator('.storage-label')).toHaveText('Storage Used');
    await expect(popupPage.locator('.storage-val')).toContainText('MB');
  });

  test('Clear All Data button requires double click', async ({ popupPage, context }) => {
    await seedSessions(context, [createMockSession()]);

    await popupPage.locator('button[aria-label="Settings"]').click();
    const dangerBtn = popupPage.locator('.danger-btn');

    await expect(dangerBtn).toHaveText('Clear All Data');

    // First click shows confirmation
    await dangerBtn.click();
    await expect(dangerBtn).toHaveText('Click again to confirm');
    await expect(dangerBtn).toHaveClass(/danger-active/);

    // Second click confirms
    await dangerBtn.click();
    await expect(popupPage.locator('.toast-text')).toHaveText('All sessions deleted');
  });

  test('settings persist across popup reloads', async ({ popupPage, extensionId }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();

    // Toggle auto-delete
    const toggle = popupPage.locator('.tv-switch').nth(1);
    await toggle.click();
    await expect(toggle).toBeChecked();

    // Reload popup
    await reloadPopup(popupPage, extensionId);

    // Check setting persisted
    await popupPage.locator('button[aria-label="Settings"]').click();
    await expect(popupPage.locator('.tv-switch').nth(1)).toBeChecked();
  });

  test('rolling backup: picking an interval saves a Backup session right away', async ({ context, popupPage, extensionId }) => {
    const site = await context.newPage();
    await site.goto('https://example.com/?snaptabs=backup-e2e');

    await popupPage.locator('button[aria-label="Settings"]').click();
    const select = popupPage.locator('select[aria-label="Rolling backup interval"]');
    await expect(select).toHaveValue('0');
    await select.selectOption({ label: '15 min' });

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

  test('sleep restored tabs toggle is in Restore and persists', async ({ popupPage, extensionId }) => {
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
});
