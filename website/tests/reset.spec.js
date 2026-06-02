import { test, expect, setup, visible, families, ollamaCloudCb, openRouterCb, latest2Cb, tlBtn } from './helpers.js';

// ─── 9. Reset button ──────────────────────────────────────────────────────

test.describe('reset button', () => {
  test('Reset after Open-only restores all models', async ({ page }) => {
    await setup(page);
    await page.click('button:has-text("Closed")');
    expect(await visible(page)).toBeLessThan(14);
    await page.click('button:has-text("Reset")');
    expect(await visible(page)).toBe(14);
  });

  test('Reset after unchecking inference source', async ({ page }) => {
    await setup(page);
    await openRouterCb(page).uncheck();
    expect(await visible(page)).toBeLessThan(14);
    await page.click('button:has-text("Reset")');
    expect(await visible(page)).toBe(14);
  });

  test('Reset after Latest-2 restores all models', async ({ page }) => {
    await setup(page);
    await latest2Cb(page).check();
    expect(await visible(page)).toBeLessThan(14);
    await page.click('button:has-text("Reset")');
    expect(await visible(page)).toBe(14);
  });

  test('Reset after Deselect-All restores all models', async ({ page }) => {
    await setup(page);
    await page.locator('.ctrl-btn').first().click();
    expect(await visible(page)).toBe(0);
    await page.click('button:has-text("Reset")');
    expect(await visible(page)).toBe(14);
  });

  test('Reset after 1Y timeline brush restores all models', async ({ page }) => {
    await setup(page);
    await tlBtn(page, '1 Y').click();
    await page.waitForTimeout(200);
    expect(await visible(page)).toBeLessThan(14);
    await page.click('button:has-text("Reset")');
    expect(await visible(page)).toBe(14);
  });

  test('Reset removes all filters simultaneously', async ({ page }) => {
    await setup(page);
    await page.click('button:has-text("Closed")');
    await latest2Cb(page).check();
    await tlBtn(page, '2 Y').click();
    await page.waitForTimeout(200);
    expect(await visible(page)).toBeLessThan(14);
    await page.click('button:has-text("Reset")');
    expect(await visible(page)).toBe(14);
    expect(await families(page)).toBe(7);
    expect(await latest2Cb(page).isChecked()).toBe(false);
    expect(await ollamaCloudCb(page).isChecked()).toBe(true);
  });
});