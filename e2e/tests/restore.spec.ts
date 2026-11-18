import { test, expect } from '../fixtures/extension';
import { reloadPopup } from '../fixtures/extension';
import { seedSessions, createMockSession, getServiceWorker } from '../helpers/storage';

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

    // Wait for restored tabs to open. A page reports about:blank until its
    // navigation commits, so poll the URLs too (httpbin.org can be slow).
    await expect(async () => {
      expect(context.pages().length).toBeGreaterThanOrEqual(pagesBefore + RESTORE_TABS.length);
      const openUrls = context.pages().map((p) => p.url());
      for (const tab of RESTORE_TABS) {
        expect(openUrls.some((url) => url.includes(new URL(tab.url).hostname))).toBe(true);
      }
    }).toPass({ timeout: 15_000 });
  });

  test('the card Restore button works from the keyboard (Enter restores, not opens)', async ({ context, popupPage, extensionId }) => {
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

    await popupPage.getByRole('button', { name: 'Restore Context restore', exact: true }).focus();
    await popupPage.keyboard.press('Enter');

    await expect(popupPage.locator('.toast-text')).toContainText('Restored', { timeout: 5_000 });
    await expect(popupPage.locator('.detail')).toHaveCount(0);

    await expect(async () => {
      expect(context.pages().length).toBeGreaterThanOrEqual(pagesBefore + 2);
    }).toPass({ timeout: 5_000 });
  });

  test('multi-window session restores each window separately', async ({ context, popupPage, extensionId }) => {
    const tab = (url: string, index: number, windowId: number) =>
      ({ url, title: url, pinned: false, isIncognito: false, index, windowId });
    await seedSessions(context, [
      createMockSession({
        id: 'restore-multi-1',
        name: 'Two windows',
        windowCount: 2,
        tabs: [
          tab('https://example.com/?w=a1', 0, 7),
          tab('https://example.com/?w=a2', 1, 7),
          tab('https://example.com/?w=b1', 0, 3),
          tab('https://example.com/?w=b2', 1, 3),
        ],
      }),
    ]);

    await reloadPopup(popupPage, extensionId);
    await popupPage.locator('.card').first().click();
    await popupPage.locator('.restore-btn').click();
    await expect(popupPage.locator('.toast-text')).toContainText('Restored', { timeout: 5_000 });

    const sw = await getServiceWorker(context);
    await expect(async () => {
      const byUrl = await sw.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        return Object.fromEntries(tabs.map((t) => [t.url || t.pendingUrl, { windowId: t.windowId, index: t.index }]));
      });
      const at = (w: string) => byUrl[`https://example.com/?w=${w}`];
      expect(at('a1') && at('a2') && at('b1') && at('b2')).toBeTruthy();
      expect(at('a1').windowId).toBe(at('a2').windowId);
      expect(at('b1').windowId).toBe(at('b2').windowId);
      expect(at('a1').windowId).not.toBe(at('b1').windowId);
      expect(at('a2').index).toBe(at('a1').index + 1);
      expect(at('b2').index).toBe(at('b1').index + 1);
    }).toPass({ timeout: 10_000 });
  });

  test('restoring a session that no longer exists reports an error', async ({ context, popupPage, extensionId }) => {
    await seedSessions(context, [createMockSession({ id: 'vanishing', name: 'Vanishing' })]);
    await reloadPopup(popupPage, extensionId);
    await popupPage.locator('.card').first().click();
    // Deleted elsewhere (e.g. another popup) while this one is open.
    await seedSessions(context, []);
    await popupPage.locator('.restore-btn').click();
    await expect(popupPage.locator('.toast-text')).toHaveText('Failed to restore');
  });

  test('every card has a visible Restore button that restores the session', async ({ context, popupPage, extensionId }) => {
    await seedSessions(context, [createMockSession({ id: 'card-restore', name: 'From the card', tabs: [
      { url: 'https://example.com/?card=1', title: 'One', pinned: false, isIncognito: false, index: 0 },
    ] })]);
    await reloadPopup(popupPage, extensionId);
    const button = popupPage.getByRole('button', { name: 'Restore From the card', exact: true });
    await expect(button).toBeVisible();
    await button.click();
    await expect(popupPage.locator('.toast-text')).toContainText('Restored');
    const sw = await getServiceWorker(context);
    await expect.poll(async () => sw.evaluate(async () =>
      (await chrome.tabs.query({})).some((t) => (t.url || t.pendingUrl) === 'https://example.com/?card=1'))).toBe(true);
  });

  test('tabs already open in the window are not opened again', async ({ context, popupPage, extensionId }) => {
    // The popup page lives in the same window as these tabs.
    const open = await context.newPage();
    await open.goto('https://example.com/?dup=a', { waitUntil: 'domcontentloaded' });
    await seedSessions(context, [createMockSession({ id: 'dup', name: 'Partly open', tabs: [
      { url: 'https://example.com/?dup=a', title: 'A', pinned: false, isIncognito: false, index: 0 },
      { url: 'https://example.com/?dup=b', title: 'B', pinned: false, isIncognito: false, index: 1 },
    ] })]);
    await reloadPopup(popupPage, extensionId);
    await popupPage.bringToFront();
    await popupPage.getByRole('button', { name: 'Restore Partly open', exact: true }).click();
    await expect(popupPage.locator('.toast-text')).toHaveText('Restored 1 tab, 1 already open');
    const sw = await getServiceWorker(context);
    const count = await sw.evaluate(async () => (await chrome.tabs.query({})).filter((t) => (t.url || t.pendingUrl) === 'https://example.com/?dup=a').length);
    expect(count).toBe(1);
  });
});

