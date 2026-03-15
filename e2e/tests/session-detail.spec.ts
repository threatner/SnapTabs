import { test, expect } from '../fixtures/extension';
import { seedSessions, createMockSessionWithGroups } from '../helpers/storage';

test.describe('Session Detail', () => {
  test.beforeEach(async ({ context }) => {
    await seedSessions(context, [createMockSessionWithGroups()]);
  });

  test('clicking a session card opens detail view', async ({ popupPage }) => {
    await popupPage.locator('.card').first().click();
    await expect(popupPage.locator('.detail')).toBeVisible();
  });

  test('detail header shows session name and tab count', async ({ popupPage }) => {
    await popupPage.locator('.card').first().click();
    await expect(popupPage.locator('.detail-title h2')).toHaveText('Grouped Session');
    await expect(popupPage.locator('.detail-title p')).toContainText('3 tabs');
  });

  test('back button returns to main view', async ({ popupPage }) => {
    await popupPage.locator('.card').first().click();
    await expect(popupPage.locator('.detail')).toBeVisible();

    await popupPage.locator('button[aria-label="Back"]').click();
    await expect(popupPage.locator('.detail')).not.toBeVisible();
    await expect(popupPage.locator('.header')).toBeVisible();
  });

  test('tab groups display with correct titles', async ({ popupPage }) => {
    await popupPage.locator('.card').first().click();
    await expect(popupPage.locator('.group-title')).toHaveText('Frameworks');
  });

  test('tab group shows correct tab count badge', async ({ popupPage }) => {
    await popupPage.locator('.card').first().click();
    await expect(popupPage.locator('.group-badge')).toHaveText('2');
  });

  test('ungrouped tabs section is visible', async ({ popupPage }) => {
    await popupPage.locator('.card').first().click();
    await expect(popupPage.locator('.ungrouped-label')).toContainText('Ungrouped tabs');
  });

  test('all tabs are listed', async ({ popupPage }) => {
    await popupPage.locator('.card').first().click();
    // 2 grouped + 1 ungrouped = 3
    await expect(popupPage.locator('.tab-title')).toHaveCount(3);
  });

  test('collapsing a tab group hides its tabs', async ({ popupPage }) => {
    await popupPage.locator('.card').first().click();

    // Click group header to collapse
    await popupPage.locator('.group-header').click();
    await expect(popupPage.locator('.group-tabs')).not.toBeVisible();
    // Only ungrouped tab remains
    await expect(popupPage.locator('.tab-item')).toHaveCount(1);
  });

  test('restore button is visible in detail view', async ({ popupPage }) => {
    await popupPage.locator('.card').first().click();
    await expect(popupPage.locator('.restore-btn')).toBeVisible();
    await expect(popupPage.locator('.restore-btn')).toContainText('Restore');
  });
});
