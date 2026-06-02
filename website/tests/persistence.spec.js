import { test, expect, setupPersist, visible, latest2Cb, ollamaCloudCb } from './helpers.js';

// ─── 10. URL persistence ─────────────────────────────────────────────────
//
// The app uses URL search params for persistence (not localStorage).
// After setting state, page.reload() preserves the URL params.

test.describe('URL persistence', () => {
  test('Open-only filter survives page reload via URL', async ({ page }) => {
    await setupPersist(page);
    await page.click('button:has-text("Closed Weights")');
    const openOnly = await visible(page);

    await page.reload();
    await page.waitForSelector('.stat-value', { timeout: 15_000 });
    expect(await visible(page)).toBe(openOnly);
  });

  test('Latest-2 setting survives page reload via URL', async ({ page }) => {
    await setupPersist(page);
    await latest2Cb(page).check();
    const latest2Count = await visible(page);

    await page.reload();
    await page.waitForSelector('.stat-value', { timeout: 15_000 });
    expect(await visible(page)).toBe(latest2Count);
    expect(await latest2Cb(page).isChecked()).toBe(true);
  });

  test('Search query survives page reload via URL', async ({ page }) => {
    await setupPersist(page);
    await page.fill('input[placeholder*="Search"]', 'deepseek');
    await page.waitForTimeout(200);
    const searchCount = await visible(page);

    await page.reload();
    await page.waitForSelector('.stat-value', { timeout: 15_000 });
    expect(await visible(page)).toBe(searchCount);
  });

  test('Unchecking inference source persists via URL', async ({ page }) => {
    await setupPersist(page);
    await ollamaCloudCb(page).uncheck();
    const filtered = await visible(page);

    await page.reload();
    await page.waitForSelector('.stat-value', { timeout: 15_000 });
    expect(await visible(page)).toBe(filtered);
    expect(await ollamaCloudCb(page).isChecked()).toBe(false);
  });
});