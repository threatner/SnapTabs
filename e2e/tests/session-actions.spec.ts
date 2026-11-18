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

  test('context menu has Pin, Rename and Delete, and no duplicate Restore', async ({ popupPage }) => {
    await openCardContextMenu(popupPage);

    await expect(popupPage.locator('.menu-item')).toHaveText(['Pin to top', 'Rename', 'Delete']);
    await expect(popupPage.locator('.action-btn').first()).toHaveAttribute('aria-expanded', 'true');
  });

  test('the "…" button appears on keyboard focus, and Escape closes the menu', async ({ popupPage }) => {
    const card = popupPage.locator('.card').first();
    const actions = card.locator('.card-actions');
    await expect(actions).toHaveCSS('opacity', '0');
    await card.focus();
    await expect(actions).toHaveCSS('opacity', '1');

    await popupPage.keyboard.press('Tab'); // the "…" button
    await expect(card.locator('.action-btn')).toBeFocused();
    await popupPage.keyboard.press('Enter');
    await expect(popupPage.locator('.context-menu')).toBeVisible();
    // Enter on the menu button must not open the detail view.
    await expect(popupPage.locator('.detail')).toHaveCount(0);
    await popupPage.keyboard.press('Escape');
    await expect(popupPage.locator('.context-menu')).toHaveCount(0);
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
    await expect(popupPage.locator('.empty-title')).toHaveText('Ready for your first snapshot');
  });

  test('detail view: the "…" menu pins, renames and deletes', async ({ popupPage }) => {
    await popupPage.locator('.card').first().click();
    await expect(popupPage.locator('.detail')).toBeVisible();
    const menu = popupPage.locator('.detail .action-btn');

    await menu.click();
    await expect(popupPage.locator('.menu-item')).toHaveText(['Pin to top', 'Rename', 'Delete']);
    await popupPage.locator('.menu-item', { hasText: 'Pin to top' }).click();
    await expect(popupPage.locator('.toast-text')).toHaveText('Session pinned');
    await expect(popupPage.locator('.detail-title .pin-icon')).toBeVisible();

    await menu.click();
    await popupPage.locator('.menu-item', { hasText: 'Rename' }).click();
    const input = popupPage.locator('.detail .rename-input');
    await input.fill('Renamed in detail');
    await input.press('Enter');
    await expect(popupPage.locator('.detail-title h2')).toHaveText('Renamed in detail');

    await menu.click();
    await popupPage.locator('.menu-item--danger').click();
    await expect(popupPage.locator('.toast-text')).toHaveText('Session deleted');
    await expect(popupPage.locator('.header')).toBeVisible();
    await expect(popupPage.locator('.card')).toHaveCount(0);
  });
});
