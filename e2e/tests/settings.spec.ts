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
    await expect(popupPage.locator('.section-label').filter({ hasText: 'Restore Options' })).toBeVisible();
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
});
