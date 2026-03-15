import { test, expect } from '../fixtures/extension';
import { seedSessions, createMockSession } from '../helpers/storage';

test.describe('Session List', () => {
  test.beforeEach(async ({ context }) => {
    const sessions = [
      createMockSession({ name: 'Work tabs', timestamp: Date.now() - 60_000 }),
      createMockSession({ name: 'Shopping list', timestamp: Date.now() - 120_000 }),
      createMockSession({
        name: 'Auto-save incognito',
        isAutoSave: true,
        hasIncognitoTabs: true,
        timestamp: Date.now() - 180_000,
      }),
    ];
    await seedSessions(context, sessions);
  });

  test('displays seeded sessions in order', async ({ popupPage }) => {
    const cards = popupPage.locator('.card');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0).locator('.card-name')).toHaveText('Work tabs');
    await expect(cards.nth(1).locator('.card-name')).toHaveText('Shopping list');
  });

  test('auto-save badge appears on auto-saved sessions', async ({ popupPage }) => {
    const autoCard = popupPage.locator('.card').filter({ hasText: 'Auto-save' });
    await expect(autoCard.locator('.badge-auto')).toBeVisible();
    await expect(autoCard.locator('.badge-auto')).toHaveText('Auto');
  });

  test('private badge appears on incognito sessions', async ({ popupPage }) => {
    const privateCard = popupPage.locator('.card').filter({ hasText: 'Auto-save' });
    await expect(privateCard.locator('.badge-private')).toContainText('Private');
  });

  test('card metadata shows tab and window count', async ({ popupPage }) => {
    const meta = popupPage.locator('.card').first().locator('.card-meta');
    await expect(meta).toContainText('2 tabs');
    await expect(meta).toContainText('1 window');
  });

  test('search filters sessions by name', async ({ popupPage }) => {
    await popupPage.locator('.search-input').fill('Work');
    await expect(popupPage.locator('.card')).toHaveCount(1);
    await expect(popupPage.locator('.card-name')).toHaveText('Work tabs');
  });

  test('search filters sessions by URL', async ({ popupPage }) => {
    await popupPage.locator('.search-input').fill('github.com');
    // All 3 sessions contain a github.com tab
    await expect(popupPage.locator('.card')).toHaveCount(3);
  });

  test('search shows no results message', async ({ popupPage }) => {
    await popupPage.locator('.search-input').fill('nonexistent query xyz');
    await expect(popupPage.locator('.empty-title')).toHaveText('No results found');
  });

  test('clearing search restores full list', async ({ popupPage }) => {
    await popupPage.locator('.search-input').fill('Work');
    await expect(popupPage.locator('.card')).toHaveCount(1);

    await popupPage.locator('.search-clear').click();
    await expect(popupPage.locator('.card')).toHaveCount(3);
  });
});
