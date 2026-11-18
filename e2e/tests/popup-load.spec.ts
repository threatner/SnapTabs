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

  test('scope defaults to This window', async ({ popupPage }) => {
    await expect(popupPage.locator('.scope-btn')).toContainText('This window');
  });

  test('header has the guide, an open-source GitHub link and Settings (D26)', async ({ popupPage }) => {
    const actions = popupPage.locator('.header .actions').locator('a, button');
    await expect(actions).toHaveCount(3);
    await expect(popupPage.getByRole('link', { name: 'How to use SnapTabs' })).toBeVisible();
    const gh = popupPage.getByRole('link', { name: 'SnapTabs on GitHub (open source)' });
    await expect(gh).toHaveAttribute('href', 'https://github.com/threatner/SnapTabs');
    await expect(gh).toHaveAttribute('target', '_blank');
    await expect(gh).toHaveAttribute('title', 'SnapTabs is open source. View it on GitHub');
  });

  test('record button is labelled for screen readers', async ({ popupPage }) => {
    const rec = popupPage.getByRole('button', { name: 'Record new tabs' });
    await expect(rec).toBeVisible();
    await expect(rec).toHaveAttribute('aria-pressed', 'false');
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
    await expect(popupPage.locator('.empty-title')).toHaveText('Ready for your first snapshot');
  });
});
