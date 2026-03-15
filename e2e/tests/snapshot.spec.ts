import { test, expect } from '../fixtures/extension';

const SITES = [
  'https://example.com',
  'https://www.wikipedia.org',
  'https://httpbin.org',
];

test.describe('Snapshot', () => {
  test('snapshots capture all open tabs from real sites', async ({ context, popupPage }) => {
    // Open several real sites in the same browser context
    for (const url of SITES) {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded' });
    }

    // Take a snapshot from the popup
    await popupPage.bringToFront();
    await popupPage.locator('.snap-btn').click();
    await expect(popupPage.locator('.toast-text')).toHaveText('Snapshot saved!', { timeout: 5_000 });

    // Session card should appear with correct tab count
    const card = popupPage.locator('.card').first();
    await expect(card).toBeVisible();
    // At least our 3 sites + the popup page itself
    await expect(card.locator('.card-meta')).toContainText('tabs');

    // Open the detail view to verify URLs were captured
    await card.click();
    await expect(popupPage.locator('.detail')).toBeVisible();
    const tabTitles = popupPage.locator('.tab-title');
    const count = await tabTitles.count();
    expect(count).toBeGreaterThanOrEqual(SITES.length);
  });

  test('switching scope to All Windows and snapshotting', async ({ context, popupPage }) => {
    // Open a site
    const page = await context.newPage();
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });

    await popupPage.bringToFront();

    // Switch to All Windows
    await popupPage.locator('.scope-btn').click();
    await popupPage.locator('.dropdown-item', { hasText: 'All Windows' }).click();
    await expect(popupPage.locator('.scope-btn')).toContainText('All Windows');

    // Snapshot
    await popupPage.locator('.snap-btn').click();
    await expect(popupPage.locator('.toast-text')).toHaveText('Snapshot saved!', { timeout: 5_000 });
    await expect(popupPage.locator('.card')).toHaveCount(1);
  });

  test('multiple snapshots create separate session cards', async ({ context, popupPage }) => {
    // Open a site
    const page = await context.newPage();
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });

    await popupPage.bringToFront();
    await popupPage.locator('.snap-btn').click();
    await expect(popupPage.locator('.toast-text')).toHaveText('Snapshot saved!', { timeout: 5_000 });
    await expect(popupPage.locator('.toast-wrap')).not.toBeVisible({ timeout: 5_000 });

    // Open another site and snapshot again
    const page2 = await context.newPage();
    await page2.goto('https://www.wikipedia.org', { waitUntil: 'domcontentloaded' });

    await popupPage.bringToFront();
    await popupPage.locator('.snap-btn').click();
    await expect(popupPage.locator('.card')).toHaveCount(2, { timeout: 5_000 });
  });
});
