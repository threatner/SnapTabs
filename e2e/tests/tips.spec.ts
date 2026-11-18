import { test, expect } from '../fixtures/extension';
import { reloadPopup } from '../fixtures/extension';
import type { BrowserContext } from '@playwright/test';
import { getServiceWorker, seedSettings } from '../helpers/storage';
import { KEYS } from '../../src/lib/storage';

async function readMeta(context: BrowserContext) {
  const sw = await getServiceWorker(context);
  return sw.evaluate(async (key) => (await chrome.storage.local.get(key))[key], KEYS.meta);
}

async function seedMeta(context: BrowserContext, meta: Record<string, unknown>) {
  const sw = await getServiceWorker(context);
  await sw.evaluate((d) => chrome.storage.local.set({ [d.key]: d.meta }), { key: KEYS.meta, meta: { statsBackfilled: true, ...meta } });
}

test.describe('One-time tips', () => {
  test('the first snapshot shows the "Saved!" tip right away, once', async ({ context, popupPage, extensionId }) => {
    const site = await context.newPage();
    await site.goto('https://example.com/?snaptabs=tip', { waitUntil: 'domcontentloaded' });
    await popupPage.bringToFront();

    await expect(popupPage.locator('.tip')).toHaveCount(0);
    await popupPage.locator('.snap-btn').click();
    await expect(popupPage.locator('.tip')).toContainText('Saved!');
    await expect(popupPage.locator('.tip')).toContainText('Your tabs are still open');
    // One confirmation per click: the tip replaces the toast (D22). A toast
    // would be on screen for 2.5 s, so a one-off count (not a retrying
    // assertion, which would pass once it fades) is the real check.
    await popupPage.waitForTimeout(300);
    expect(await popupPage.locator('.toast-wrap').count()).toBe(0);

    await popupPage.getByLabel('Dismiss tip').click();
    await expect(popupPage.locator('.tip')).toHaveCount(0);
    await expect.poll(async () => (await readMeta(context))?.pendingTips).toEqual([]);

    // A second snapshot never brings it back.
    await seedSettings(context, { warnOnDuplicateSnapshot: false });
    await reloadPopup(popupPage, extensionId);
    await popupPage.locator('.snap-btn').click();
    await expect(popupPage.locator('.toast-text')).toHaveText('Snapshot saved!');
    await expect(popupPage.locator('.tip')).toHaveCount(0);
    await site.close();
  });

  test('the sleep tip offers a shortcut to Settings', async ({ context, popupPage, extensionId }) => {
    await seedMeta(context, { pendingTips: ['firstRestore'], stats: { restores: 1 } });
    await reloadPopup(popupPage, extensionId);
    const tip = popupPage.locator('.tip');
    await expect(tip).toContainText('Restored tabs are asleep');
    await tip.getByRole('button', { name: 'Settings' }).click();
    await expect(popupPage.locator('.settings')).toBeVisible();
    await expect.poll(async () => (await readMeta(context))?.pendingTips).toEqual([]);
  });

  test("a pending tip takes the rating banner's place; the banner returns after", async ({ context, popupPage, extensionId }) => {
    await seedMeta(context, { pendingTips: ['firstSnapshot'], stats: { manualSnapshots: 5 } });
    await reloadPopup(popupPage, extensionId);
    await expect(popupPage.locator('.tip')).toBeVisible();
    await expect(popupPage.locator('.rating')).toHaveCount(0);
    await popupPage.getByLabel('Dismiss tip').click();
    await expect(popupPage.locator('.rating')).toContainText('Enjoying SnapTabs?');
  });

  test('a long-time user (stats backfilled with snapshots) never gets the first-snapshot tip', async ({ context, popupPage, extensionId }) => {
    await seedMeta(context, { stats: { manualSnapshots: 12 }, ratingPromptDone: true });
    await seedSettings(context, { warnOnDuplicateSnapshot: false });
    await reloadPopup(popupPage, extensionId);
    await popupPage.locator('.snap-btn').click();
    await expect(popupPage.locator('.toast-text')).toHaveText('Snapshot saved!');
    await expect(popupPage.locator('.tip')).toHaveCount(0);
  });
});
