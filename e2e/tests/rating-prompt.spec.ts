import { test, expect } from '../fixtures/extension';
import { reloadPopup } from '../fixtures/extension';
import type { BrowserContext } from '@playwright/test';
import { getServiceWorker, seedSessions, createMockSession } from '../helpers/storage';
import { KEYS } from '../../src/lib/storage';
import { REVIEW_URL } from '../../src/lib/links';

async function seedMeta(context: BrowserContext, meta: { restoreCount: number; ratingPromptDone: boolean }) {
  const sw = await getServiceWorker(context);
  await sw.evaluate((d) => chrome.storage.local.set({ [d.key]: d.meta }), { key: KEYS.meta, meta });
}

async function readMeta(context: BrowserContext) {
  const sw = await getServiceWorker(context);
  return sw.evaluate(async (key) => (await chrome.storage.local.get(key))[key], KEYS.meta);
}

test.describe('Rating prompt', () => {
  test('is hidden before the third restore', async ({ context, popupPage, extensionId }) => {
    await seedMeta(context, { restoreCount: 2, ratingPromptDone: false });
    await reloadPopup(popupPage, extensionId);
    await expect(popupPage.locator('.rating')).toHaveCount(0);
  });

  test('restoring from the popup counts toward the prompt', async ({ context, popupPage, extensionId }) => {
    await seedSessions(context, [createMockSession({ id: 'count-me', name: 'Count me', tabs: [
      { url: 'https://example.com/?snaptabs=rating', title: 'Example', pinned: false, isIncognito: false, index: 0 },
    ] })]);
    await reloadPopup(popupPage, extensionId);
    await popupPage.locator('.card').first().click();
    await popupPage.locator('.restore-btn').click();
    await expect.poll(async () => (await readMeta(context))?.restoreCount).toBe(1);
  });

  test('appears after three restores', async ({ context, popupPage, extensionId }) => {
    await seedMeta(context, { restoreCount: 3, ratingPromptDone: false });
    await reloadPopup(popupPage, extensionId);
    await expect(popupPage.locator('.rating')).toContainText('Enjoying SnapTabs?');
  });

  test('dismissing hides it for good, even if the popup closes right away', async ({ context, popupPage, extensionId }) => {
    await seedMeta(context, { restoreCount: 3, ratingPromptDone: false });
    await reloadPopup(popupPage, extensionId);
    await popupPage.getByLabel('Dismiss rating prompt').click();
    await expect(popupPage.locator('.rating')).toHaveCount(0);
    // Close immediately, as a user closing the popup would.
    await popupPage.goto('about:blank');
    await expect.poll(async () => (await readMeta(context))?.ratingPromptDone).toBe(true);
    await reloadPopup(popupPage, extensionId);
    await expect(popupPage.locator('.rating')).toHaveCount(0);
  });

  test('"Rate it" opens the store reviews page and hides it for good', async ({ context, popupPage, extensionId }) => {
    await seedMeta(context, { restoreCount: 5, ratingPromptDone: false });
    await reloadPopup(popupPage, extensionId);
    await popupPage.getByRole('button', { name: 'Rate it' }).click();
    // Playwright doesn't surface Chrome Web Store tabs as pages (the store is
    // a protected origin), so ask Chrome which tabs exist.
    const sw = await getServiceWorker(context);
    await expect.poll(async () => sw.evaluate(async (url) =>
      (await chrome.tabs.query({})).some((t) => (t.url || t.pendingUrl) === url), REVIEW_URL)).toBe(true);
    expect((await readMeta(context)).ratingPromptDone).toBe(true);
    await reloadPopup(popupPage, extensionId);
    await expect(popupPage.locator('.rating')).toHaveCount(0);
  });
});
