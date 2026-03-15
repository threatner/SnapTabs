import { test, expect } from '../fixtures/extension';

test.describe('Popup Loading', () => {
  test('popup renders with correct dimensions', async ({ popupPage }) => {
    const popup = popupPage.locator('.popup');
    await expect(popup).toBeVisible();
    const box = await popup.boundingBox();
    expect(box?.width).toBe(400);
    expect(box?.height).toBe(600);
  });

  test('header displays SnapTabs brand', async ({ popupPage }) => {
    await expect(popupPage.locator('.brand-text h1')).toHaveText('SnapTabs');
  });

  test('settings button is visible', async ({ popupPage }) => {
    await expect(popupPage.locator('button[aria-label="Settings"]')).toBeVisible();
  });

  test('scope defaults to Current Window', async ({ popupPage }) => {
    await expect(popupPage.locator('.scope-btn')).toContainText('Current Window');
  });

  test('snapshot button is visible and enabled', async ({ popupPage }) => {
    const btn = popupPage.locator('.snap-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
    await expect(btn).toContainText('Snapshot');
  });

  test('search input is present', async ({ popupPage }) => {
    await expect(popupPage.locator('.search-input')).toBeVisible();
  });

  test('empty state shown when no sessions exist', async ({ popupPage }) => {
    await expect(popupPage.locator('.empty-title')).toHaveText('No sessions saved');
  });
});
