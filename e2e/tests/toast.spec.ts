import { test, expect } from '../fixtures/extension';
import { openCardContextMenu, reloadPopup } from '../fixtures/extension';
import { seedSessions, createMockSession } from '../helpers/storage';

test.describe('Toast Notifications', () => {
  test.beforeEach(async ({ context, popupPage, extensionId }) => {
    await seedSessions(context, [createMockSession({ name: 'Toast me' })]);
    await reloadPopup(popupPage, extensionId);
  });

  test('appears at the bottom, inside a status region (D22)', async ({ popupPage }) => {
    await openCardContextMenu(popupPage);
    await popupPage.locator('.menu-item', { hasText: 'Pin to top' }).click();
    const toast = popupPage.locator('.toast-wrap');
    await expect(toast).toBeVisible();
    await expect(popupPage.locator('.toast-text')).toHaveText('Session pinned');
    await expect(popupPage.getByRole('status').filter({ has: toast })).toHaveAttribute('aria-live', 'polite');
    const box = await toast.boundingBox();
    // Bottom of the 600px popup, clear of the header's "N sessions saved".
    expect(box!.y).toBeGreaterThan(500);
  });

  test('auto-dismisses after ~2.5 seconds', async ({ popupPage }) => {
    await openCardContextMenu(popupPage);
    await popupPage.locator('.menu-item', { hasText: 'Pin to top' }).click();
    await expect(popupPage.locator('.toast-wrap')).toBeVisible();
    await expect(popupPage.locator('.toast-wrap')).not.toBeVisible({ timeout: 5_000 });
  });
});
