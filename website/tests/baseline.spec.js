import { test, expect, setup, visible, families, ollamaCloudCb, ollamaLocalCb, openRouterCb, otherSourceCb, latest2Cb } from './helpers.js';

// ─── 1. Baseline load ──────────────────────────────────────────────────────

test.describe('baseline load', () => {
  test('loads all 14 models across 7 families', async ({ page }) => {
    await setup(page);
    expect(await visible(page)).toBe(14);
    expect(await families(page)).toBe(7);
  });

  test('key UI controls are present', async ({ page }) => {
    await setup(page);
    await expect(page.locator('button:has-text("Open Weights")')).toBeVisible();
    await expect(page.locator('button:has-text("Closed Weights")')).toBeVisible();
    await expect(ollamaCloudCb(page)).toBeVisible();
    await expect(ollamaLocalCb(page)).toBeVisible();
    await expect(openRouterCb(page)).toBeVisible();
    await expect(otherSourceCb(page)).toBeVisible();
    await expect(latest2Cb(page)).toBeVisible();
    await expect(page.locator('button:has-text("↺ Reset")')).toBeVisible();
    await expect(page.locator('button:has-text("⊞")')).toBeVisible();
    await expect(page.locator('button:has-text("⊟")')).toBeVisible();
  });

  test('stat cards render correctly', async ({ page }) => {
    await setup(page);
    const labels = await page.locator('.stat-label').allTextContents();
    expect(labels).toContain('Visible');
    expect(labels).toContain('Families');
    expect(labels).toContain('Top Overall');
  });
});