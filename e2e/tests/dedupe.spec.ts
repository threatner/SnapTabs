import { test, expect } from '../fixtures/extension';
import { reloadPopup } from '../fixtures/extension';
import { seedSettings, clearStorage } from '../helpers/storage';

test.describe('Duplicate snapshot warning', () => {
  test('second identical snapshot triggers the duplicate modal', async ({ context, popupPage }) => {
    const page = await context.newPage();
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });

    await popupPage.bringToFront();

    // First snapshot
    await popupPage.locator('.snap-btn').click();
    await expect(popupPage.locator('.toast-text')).toHaveText('Snapshot saved!', { timeout: 5_000 });
    await expect(popupPage.locator('.card')).toHaveCount(1);

    // Wait for toast to dismiss so it doesn't block UI assertions
    await expect(popupPage.locator('.toast-wrap')).not.toBeVisible({ timeout: 5_000 });

    // Second snapshot with the same tabs — modal should appear
    await popupPage.locator('.snap-btn').click();
    await expect(popupPage.locator('.modal')).toBeVisible();
    await expect(popupPage.locator('.modal-title')).toHaveText('Looks like a duplicate');
    await expect(popupPage.locator('.modal-body')).toContainText('match your last snapshot');

    // No new session yet
    await expect(popupPage.locator('.card')).toHaveCount(1);
  });

  test('Cancel button dismisses modal without creating a session', async ({ context, popupPage }) => {
    const page = await context.newPage();
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    await popupPage.bringToFront();

    await popupPage.locator('.snap-btn').click();
    await expect(popupPage.locator('.toast-text')).toHaveText('Snapshot saved!', { timeout: 5_000 });
    await expect(popupPage.locator('.toast-wrap')).not.toBeVisible({ timeout: 5_000 });

    await popupPage.locator('.snap-btn').click();
    await expect(popupPage.locator('.modal')).toBeVisible();

    await popupPage.locator('.modal-btn--ghost', { hasText: 'Cancel' }).click();
    await expect(popupPage.locator('.modal')).not.toBeVisible();
    await expect(popupPage.locator('.card')).toHaveCount(1);
  });

  test('Save anyway creates a second session', async ({ context, popupPage }) => {
    const page = await context.newPage();
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    await popupPage.bringToFront();

    await popupPage.locator('.snap-btn').click();
    await expect(popupPage.locator('.toast-text')).toHaveText('Snapshot saved!', { timeout: 5_000 });
    await expect(popupPage.locator('.toast-wrap')).not.toBeVisible({ timeout: 5_000 });

    await popupPage.locator('.snap-btn').click();
    await expect(popupPage.locator('.modal')).toBeVisible();

    await popupPage.locator('.modal-btn--primary', { hasText: 'Save anyway' }).click();
    await expect(popupPage.locator('.modal')).not.toBeVisible();
    await expect(popupPage.locator('.toast-text')).toHaveText('Snapshot saved!', { timeout: 5_000 });
    await expect(popupPage.locator('.card')).toHaveCount(2, { timeout: 5_000 });
  });

  test('clicking backdrop dismisses modal', async ({ context, popupPage }) => {
    const page = await context.newPage();
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    await popupPage.bringToFront();

    await popupPage.locator('.snap-btn').click();
    await expect(popupPage.locator('.toast-text')).toHaveText('Snapshot saved!', { timeout: 5_000 });
    await expect(popupPage.locator('.toast-wrap')).not.toBeVisible({ timeout: 5_000 });

    await popupPage.locator('.snap-btn').click();
    await expect(popupPage.locator('.modal')).toBeVisible();

    // Click outside the modal (on the backdrop)
    await popupPage.locator('.modal-backdrop').click({ position: { x: 10, y: 10 } });
    await expect(popupPage.locator('.modal')).not.toBeVisible();
    await expect(popupPage.locator('.card')).toHaveCount(1);
  });

  test('different tab set does not trigger modal', async ({ context, popupPage }) => {
    const page = await context.newPage();
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    await popupPage.bringToFront();

    await popupPage.locator('.snap-btn').click();
    await expect(popupPage.locator('.toast-text')).toHaveText('Snapshot saved!', { timeout: 5_000 });
    await expect(popupPage.locator('.toast-wrap')).not.toBeVisible({ timeout: 5_000 });

    // Open an extra page so the tab set differs from the first snapshot
    const page2 = await context.newPage();
    await page2.goto('https://www.wikipedia.org', { waitUntil: 'domcontentloaded' });

    await popupPage.bringToFront();
    await popupPage.locator('.snap-btn').click();
    await expect(popupPage.locator('.toast-text')).toHaveText('Snapshot saved!', { timeout: 5_000 });
    await expect(popupPage.locator('.modal')).not.toBeVisible();
    await expect(popupPage.locator('.card')).toHaveCount(2, { timeout: 5_000 });
  });

  test('warning is bypassed when warnOnDuplicateSnapshot is off', async ({ context, extensionId, popupPage }) => {
    await clearStorage(context);
    await seedSettings(context, { warnOnDuplicateSnapshot: false });
    await reloadPopup(popupPage, extensionId);

    const page = await context.newPage();
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    await popupPage.bringToFront();

    await popupPage.locator('.snap-btn').click();
    await expect(popupPage.locator('.toast-text')).toHaveText('Snapshot saved!', { timeout: 5_000 });
    await expect(popupPage.locator('.toast-wrap')).not.toBeVisible({ timeout: 5_000 });

    // Second snapshot — modal should NOT appear, session created directly
    await popupPage.locator('.snap-btn').click();
    await expect(popupPage.locator('.toast-text')).toHaveText('Snapshot saved!', { timeout: 5_000 });
    await expect(popupPage.locator('.modal')).not.toBeVisible();
    await expect(popupPage.locator('.card')).toHaveCount(2, { timeout: 5_000 });
  });

  test('Warn on duplicate snapshot toggle is present in settings', async ({ popupPage }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();
    await expect(popupPage.locator('.section-label').filter({ hasText: 'Snapshot' })).toBeVisible();

    const toggleRow = popupPage.locator('.setting-row', { hasText: 'Warn on duplicate snapshot' });
    await expect(toggleRow).toBeVisible();
    const toggle = toggleRow.locator('.tv-switch');
    await expect(toggle).toBeChecked(); // default true
    await toggle.click();
    await expect(toggle).not.toBeChecked();
  });
});
