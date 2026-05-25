import { test, expect } from '../fixtures/extension';
import { reloadPopup } from '../fixtures/extension';
import { seedSettings, clearStorage } from '../helpers/storage';

test.describe('Excluded Domains — Settings UI', () => {
  test('section is visible under the Snapshot category', async ({ popupPage }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();
    await expect(popupPage.locator('.section-label').filter({ hasText: 'Snapshot' })).toBeVisible();
    await expect(popupPage.locator('.setting-title').filter({ hasText: 'Excluded domains' })).toBeVisible();
    await expect(popupPage.locator('.domain-input')).toBeVisible();
  });

  test('shows no chips and no count when no domains are configured', async ({ popupPage }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();
    await expect(popupPage.locator('.domain-chip')).toHaveCount(0);
    await expect(popupPage.locator('.count-pill')).not.toBeVisible();
  });

  test('adds a domain via the Add button', async ({ popupPage }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();

    const input = popupPage.locator('.domain-input');
    await input.fill('mail.google.com');

    // Add button only appears when input has value
    const addBtn = popupPage.locator('.domain-add', { hasText: 'Add' });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    await expect(popupPage.locator('.domain-chip')).toHaveCount(1);
    await expect(popupPage.locator('.domain-chip').first()).toContainText('mail.google.com');
    await expect(popupPage.locator('.count-pill')).toHaveText('1');
    await expect(input).toHaveValue('');
  });

  test('adds a domain by pressing Enter', async ({ popupPage }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();

    const input = popupPage.locator('.domain-input');
    await input.fill('github.com');
    await input.press('Enter');

    await expect(popupPage.locator('.domain-chip')).toHaveCount(1);
    await expect(popupPage.locator('.domain-chip').first()).toContainText('github.com');
  });

  test('normalizes input by stripping protocol, www, path, and casing', async ({ popupPage }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();
    const input = popupPage.locator('.domain-input');

    await input.fill('https://www.GitHub.com/some/path?q=1');
    await input.press('Enter');

    await expect(popupPage.locator('.domain-chip').first()).toContainText('github.com');
  });

  test('does not add the same domain twice', async ({ popupPage }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();
    const input = popupPage.locator('.domain-input');

    await input.fill('foo.com');
    await input.press('Enter');
    await expect(popupPage.locator('.domain-chip')).toHaveCount(1);

    await input.fill('foo.com');
    await input.press('Enter');
    await expect(popupPage.locator('.domain-chip')).toHaveCount(1);
    await expect(popupPage.locator('.count-pill')).toHaveText('1');
  });

  test('does not add blank input', async ({ popupPage }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();
    const input = popupPage.locator('.domain-input');

    await input.fill('   ');
    await input.press('Enter');
    await expect(popupPage.locator('.domain-chip')).toHaveCount(0);
    await expect(popupPage.locator('.count-pill')).not.toBeVisible();
  });

  test('removes a domain via the X button', async ({ popupPage }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();
    const input = popupPage.locator('.domain-input');

    await input.fill('one.com');
    await input.press('Enter');
    await input.fill('two.com');
    await input.press('Enter');
    await expect(popupPage.locator('.domain-chip')).toHaveCount(2);
    await expect(popupPage.locator('.count-pill')).toHaveText('2');

    await popupPage.locator('button[aria-label="Remove one.com"]').click();
    await expect(popupPage.locator('.domain-chip')).toHaveCount(1);
    await expect(popupPage.locator('.domain-chip').first()).toContainText('two.com');
    await expect(popupPage.locator('.count-pill')).toHaveText('1');
  });

  test('returns to empty state after removing the last domain', async ({ popupPage }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();
    const input = popupPage.locator('.domain-input');

    await input.fill('only.com');
    await input.press('Enter');
    await expect(popupPage.locator('.domain-chip')).toHaveCount(1);

    await popupPage.locator('button[aria-label="Remove only.com"]').click();
    await expect(popupPage.locator('.domain-chip')).toHaveCount(0);
    await expect(popupPage.locator('.count-pill')).not.toBeVisible();
  });

  test('excluded domains persist across popup reloads', async ({ popupPage, extensionId }) => {
    await popupPage.locator('button[aria-label="Settings"]').click();
    const input = popupPage.locator('.domain-input');

    await input.fill('persist.com');
    await input.press('Enter');
    await expect(popupPage.locator('.domain-chip')).toHaveCount(1);

    await reloadPopup(popupPage, extensionId);
    await popupPage.locator('button[aria-label="Settings"]').click();

    await expect(popupPage.locator('.domain-chip')).toHaveCount(1);
    await expect(popupPage.locator('.domain-chip').first()).toContainText('persist.com');
    await expect(popupPage.locator('.count-pill')).toHaveText('1');
  });
});

test.describe('Excluded Domains — Snapshot integration', () => {
  test('snapshot omits tabs from an excluded domain', async ({ context, extensionId, popupPage }) => {
    await clearStorage(context);
    await seedSettings(context, { excludedDomains: ['example.com'], warnOnDuplicateSnapshot: false });
    await reloadPopup(popupPage, extensionId);

    // One tab on the excluded domain, one on a different one
    const blocked = await context.newPage();
    await blocked.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    const keeper = await context.newPage();
    await keeper.goto('https://www.wikipedia.org', { waitUntil: 'domcontentloaded' });

    await popupPage.bringToFront();
    await popupPage.locator('.snap-btn').click();
    await expect(popupPage.locator('.toast-text')).toHaveText('Snapshot saved!', { timeout: 5_000 });

    // Open the resulting session and ensure example.com is not in it
    await popupPage.locator('.card').first().click();
    await expect(popupPage.locator('.detail')).toBeVisible();
    const titles = popupPage.locator('.tab-title');
    const count = await titles.count();
    for (let i = 0; i < count; i++) {
      const text = await titles.nth(i).textContent();
      expect(text?.toLowerCase()).not.toContain('example domain');
    }
    // Wikipedia should still be present
    await expect(popupPage.locator('.detail')).toContainText(/wikipedia/i);
  });

  test('snapshot also excludes subdomains of an excluded parent domain', async ({ context, extensionId, popupPage }) => {
    await clearStorage(context);
    await seedSettings(context, { excludedDomains: ['wikipedia.org'], warnOnDuplicateSnapshot: false });
    await reloadPopup(popupPage, extensionId);

    const sub = await context.newPage();
    // en.wikipedia.org is a subdomain of wikipedia.org
    await sub.goto('https://en.wikipedia.org/wiki/Main_Page', { waitUntil: 'domcontentloaded' });
    const keeper = await context.newPage();
    await keeper.goto('https://example.com', { waitUntil: 'domcontentloaded' });

    await popupPage.bringToFront();
    await popupPage.locator('.snap-btn').click();
    await expect(popupPage.locator('.toast-text')).toHaveText('Snapshot saved!', { timeout: 5_000 });

    await popupPage.locator('.card').first().click();
    await expect(popupPage.locator('.detail')).toBeVisible();
    await expect(popupPage.locator('.detail')).not.toContainText(/wikipedia/i);
    await expect(popupPage.locator('.detail')).toContainText(/example/i);
  });
});
