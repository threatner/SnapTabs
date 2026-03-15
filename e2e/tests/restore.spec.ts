import { test, expect } from '../fixtures/extension';
import { reloadPopup, openCardContextMenu } from '../fixtures/extension';
import { seedSessions, createMockSession } from '../helpers/storage';

const RESTORE_TABS = [
  { url: 'https://example.com', title: 'Example Domain', pinned: false, isIncognito: false, index: 0 },
  { url: 'https://www.wikipedia.org', title: 'Wikipedia', pinned: false, isIncognito: false, index: 1 },
  { url: 'https://httpbin.org', title: 'httpbin', pinned: false, isIncognito: false, index: 2 },
];

test.describe('Restore', () => {
  test('restoring a session opens all saved URLs', async ({ context, popupPage, extensionId }) => {
    await seedSessions(context, [
      createMockSession({ id: 'restore-test-1', name: 'Sites to restore', tabs: RESTORE_TABS }),
    ]);

    await reloadPopup(popupPage, extensionId);

    const pagesBefore = context.pages().length;

    await popupPage.locator('.card').first().click();
    await expect(popupPage.locator('.detail')).toBeVisible();

    await popupPage.locator('.restore-btn').click();
    await expect(popupPage.locator('.toast-text')).toContainText('Restored', { timeout: 5_000 });

    // Wait for restored tabs to open
    await expect(async () => {
      expect(context.pages().length).toBeGreaterThanOrEqual(pagesBefore + RESTORE_TABS.length);
    }).toPass({ timeout: 5_000 });

    const openUrls = context.pages().map((p) => p.url());
    for (const tab of RESTORE_TABS) {
      expect(openUrls.some((url) => url.includes(new URL(tab.url).hostname))).toBe(true);
    }
  });

  test('restore via context menu opens tabs', async ({ context, popupPage, extensionId }) => {
    await seedSessions(context, [
      createMockSession({
        id: 'restore-ctx-1',
        name: 'Context restore',
        tabs: [
          { url: 'https://example.com', title: 'Example', pinned: false, isIncognito: false, index: 0 },
          { url: 'https://www.wikipedia.org', title: 'Wikipedia', pinned: false, isIncognito: false, index: 1 },
        ],
      }),
    ]);

    await reloadPopup(popupPage, extensionId);

    const pagesBefore = context.pages().length;

    await openCardContextMenu(popupPage);
    await popupPage.locator('.menu-item').filter({ hasText: 'Restore Session' }).click();

    await expect(popupPage.locator('.toast-text')).toContainText('Restored', { timeout: 5_000 });

    await expect(async () => {
      expect(context.pages().length).toBeGreaterThanOrEqual(pagesBefore + 2);
    }).toPass({ timeout: 5_000 });
  });
});
