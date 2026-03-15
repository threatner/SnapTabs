import { test, expect } from '../fixtures/extension';
import { reloadPopup } from '../fixtures/extension';

test.describe('Recording', () => {
  test('record toggle button is visible', async ({ popupPage }) => {
    await expect(popupPage.locator('.rec-toggle')).toBeVisible();
  });

  test('clicking record toggle starts recording', async ({ popupPage }) => {
    await popupPage.locator('.rec-toggle').click();

    await expect(popupPage.locator('.toast-text')).toHaveText('Recording started', { timeout: 5_000 });
    await expect(popupPage.locator('.rec-bar')).toBeVisible();
    await expect(popupPage.locator('.rec-label')).toHaveText('REC');
  });

  test('recording bar shows tab count', async ({ popupPage }) => {
    await popupPage.locator('.rec-toggle').click();
    await expect(popupPage.locator('.rec-bar')).toBeVisible();
    await expect(popupPage.locator('.rec-count')).toContainText('tab');
  });

  test('recording bar has stop and cancel buttons', async ({ popupPage }) => {
    await popupPage.locator('.rec-toggle').click();
    await expect(popupPage.locator('.rec-bar')).toBeVisible();

    await expect(popupPage.locator('.rec-stop')).toBeVisible();
    await expect(popupPage.locator('.rec-stop')).toContainText('Stop & Save');
    await expect(popupPage.locator('.rec-cancel')).toBeVisible();
    await expect(popupPage.locator('.rec-cancel')).toHaveText('Cancel');
  });

  test('cancel recording dismisses recording bar', async ({ popupPage }) => {
    await popupPage.locator('.rec-toggle').click();
    await expect(popupPage.locator('.rec-bar')).toBeVisible();

    await popupPage.locator('.rec-cancel').click();
    await expect(popupPage.locator('.toast-text')).toHaveText('Recording cancelled');
    await expect(popupPage.locator('.rec-bar')).not.toBeVisible();
  });

  test('header shows recording indicator', async ({ popupPage }) => {
    await popupPage.locator('.rec-toggle').click();
    await expect(popupPage.locator('.rec-indicator')).toBeVisible();
    await expect(popupPage.locator('.rec-indicator')).toContainText('Recording');
  });

  test('recording captures newly opened tabs and saves them', async ({ context, popupPage, extensionId }) => {
    await popupPage.locator('.rec-toggle').click();
    await expect(popupPage.locator('.rec-bar')).toBeVisible({ timeout: 5_000 });

    const sites = [
      'https://example.com',
      'https://www.wikipedia.org',
      'https://httpbin.org',
    ];
    for (const url of sites) {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      // Wait for the background onUpdated listener to fire
      await page.waitForLoadState('load');
    }

    // Reload popup to pick up updated recording state
    await popupPage.bringToFront();
    await reloadPopup(popupPage, extensionId);

    await expect(popupPage.locator('.rec-bar')).toBeVisible();
    const countText = await popupPage.locator('.rec-count').textContent();
    const captured = parseInt(countText || '0');
    expect(captured).toBeGreaterThanOrEqual(sites.length);

    await popupPage.locator('.rec-stop').click();

    await expect(popupPage.locator('.rec-bar')).not.toBeVisible({ timeout: 5_000 });
    const card = popupPage.locator('.card').first();
    await expect(card).toBeVisible({ timeout: 5_000 });

    await card.click();
    await expect(popupPage.locator('.detail')).toBeVisible();
    const count = await popupPage.locator('.tab-title').count();
    expect(count).toBeGreaterThanOrEqual(sites.length);
  });

  test('recording does not capture duplicate tabs', async ({ context, popupPage, extensionId }) => {
    await popupPage.locator('.rec-toggle').click();
    await expect(popupPage.locator('.rec-bar')).toBeVisible({ timeout: 5_000 });

    const page1 = await context.newPage();
    await page1.goto('https://example.com', { waitUntil: 'load' });

    const page2 = await context.newPage();
    await page2.goto('https://example.com', { waitUntil: 'load' });

    await popupPage.bringToFront();
    await reloadPopup(popupPage, extensionId);

    await popupPage.locator('.rec-stop').click();
    await expect(popupPage.locator('.rec-bar')).not.toBeVisible({ timeout: 5_000 });

    const card = popupPage.locator('.card').first();
    await expect(card).toBeVisible({ timeout: 5_000 });
    await card.click();
    await expect(popupPage.locator('.detail')).toBeVisible();

    // Use allTextContents() instead of sequential nth() calls
    const allTitles = await popupPage.locator('.tab-title').allTextContents();
    const exampleCount = allTitles.filter((t) => t.toLowerCase().includes('example')).length;
    expect(exampleCount).toBe(1);
  });
});
