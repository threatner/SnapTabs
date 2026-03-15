import { test, expect } from '../fixtures/extension';

test.describe('Toast Notifications', () => {
  test('success toast appears on snapshot', async ({ popupPage }) => {
    await popupPage.locator('.snap-btn').click();
    await expect(popupPage.locator('.toast-wrap')).toBeVisible({ timeout: 5_000 });
    await expect(popupPage.locator('.toast-text')).toHaveText('Snapshot saved!');
  });

  test('toast auto-dismisses after ~2.5 seconds', async ({ popupPage }) => {
    await popupPage.locator('.snap-btn').click();
    await expect(popupPage.locator('.toast-wrap')).toBeVisible({ timeout: 5_000 });
    await expect(popupPage.locator('.toast-wrap')).not.toBeVisible({ timeout: 5_000 });
  });
});
