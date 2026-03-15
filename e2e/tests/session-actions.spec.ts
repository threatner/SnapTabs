import { test, expect } from '../fixtures/extension';
import { openCardContextMenu } from '../fixtures/extension';
import { seedSessions, createMockSession } from '../helpers/storage';

test.describe('Session Actions', () => {
  test.beforeEach(async ({ context }) => {
    await seedSessions(context, [createMockSession({ name: 'My session' })]);
  });

  test('context menu opens on action button click', async ({ popupPage }) => {
    await openCardContextMenu(popupPage);
    await expect(popupPage.locator('.context-menu')).toBeVisible();
  });

  test('context menu has Restore, Rename, and Delete options', async ({ popupPage }) => {
    await openCardContextMenu(popupPage);

    await expect(popupPage.locator('.menu-item').filter({ hasText: 'Restore Session' })).toBeVisible();
    await expect(popupPage.locator('.menu-item').filter({ hasText: 'Rename' })).toBeVisible();
    await expect(popupPage.locator('.menu-item--danger').filter({ hasText: 'Delete' })).toBeVisible();
  });

  test('rename via context menu shows inline input', async ({ popupPage }) => {
    await openCardContextMenu(popupPage);
    await popupPage.locator('.menu-item', { hasText: 'Rename' }).click();

    const input = popupPage.locator('.rename-input');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('My session');
  });

  test('rename commits on Enter', async ({ popupPage }) => {
    await openCardContextMenu(popupPage);
    await popupPage.locator('.menu-item', { hasText: 'Rename' }).click();

    const input = popupPage.locator('.rename-input');
    await input.fill('Renamed session');
    await input.press('Enter');

    await expect(popupPage.locator('.card-name').first()).toHaveText('Renamed session');
    await expect(popupPage.locator('.toast-text')).toHaveText('Session renamed');
  });

  test('rename with same value on Escape keeps original name', async ({ popupPage }) => {
    await openCardContextMenu(popupPage);
    await popupPage.locator('.menu-item', { hasText: 'Rename' }).click();

    const input = popupPage.locator('.rename-input');
    await input.press('Escape');

    await expect(popupPage.locator('.card-name').first()).toHaveText('My session');
  });

  test('delete via context menu removes session', async ({ popupPage }) => {
    await openCardContextMenu(popupPage);
    await popupPage.locator('.menu-item--danger').click();

    await expect(popupPage.locator('.toast-text')).toHaveText('Session deleted');
    await expect(popupPage.locator('.card')).toHaveCount(0);
    await expect(popupPage.locator('.empty-title')).toHaveText('No sessions saved');
  });

  test('delete from detail view requires double click', async ({ popupPage }) => {
    await popupPage.locator('.card').first().click();
    await expect(popupPage.locator('.detail')).toBeVisible();

    const delBtn = popupPage.locator('button[aria-label="Delete"]');
    await delBtn.click();
    await expect(delBtn).toHaveClass(/del-active/);

    await delBtn.click();
    await expect(popupPage.locator('.toast-text')).toHaveText('Session deleted');
    await expect(popupPage.locator('.header')).toBeVisible();
  });
});
