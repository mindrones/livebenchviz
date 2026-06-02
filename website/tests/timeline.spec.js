import { test, expect, setup, visible, tlBtn } from './helpers.js';

// ─── 7. Timeline presets ──────────────────────────────────────────────────
//
// Timeline preset buttons: 6 M, 1 Y, 2 Y, 3 Y, All
// Dates relative to "now" — we use mock data where:
//   Old models: gpt-4o (2023-06), gemma-2 (2024-06)
//   Recent models: everything from 2024-12 onward
//
// Since "now" is the test run time, the exact counts for 1Y/2Y/3Y depend on
// the current date. We test structural properties instead:
//   All ≥ 3Y ≥ 2Y ≥ 1Y ≥ 6M (monotonic narrowing)
//   All restores everything
//   Any preset reduces the count vs. "All"

test.describe('timeline presets', () => {
  test('All: shows all 14 models', async ({ page }) => {
    await setup(page);
    await tlBtn(page, 'All').click();
    await page.waitForTimeout(200);
    expect(await visible(page)).toBe(14);
  });

  test('1 Y reduces visible count', async ({ page }) => {
    await setup(page);
    const before = await visible(page);
    await tlBtn(page, '1 Y').click();
    await page.waitForTimeout(200);
    expect(await visible(page)).toBeLessThan(before);
  });

  test('Timeline counts narrow monotonically: All ≥ 3Y ≥ 2Y ≥ 1Y', async ({ page }) => {
    await setup(page);
    await tlBtn(page, 'All').click(); await page.waitForTimeout(100);
    const allCount = await visible(page);

    await tlBtn(page, '3 Y').click(); await page.waitForTimeout(100);
    const y3 = await visible(page);

    await tlBtn(page, '2 Y').click(); await page.waitForTimeout(100);
    const y2 = await visible(page);

    await tlBtn(page, '1 Y').click(); await page.waitForTimeout(100);
    const y1 = await visible(page);

    expect(allCount).toBeGreaterThanOrEqual(y3);
    expect(y3).toBeGreaterThanOrEqual(y2);
    expect(y2).toBeGreaterThanOrEqual(y1);
  });

  test('All preset restores full count after 1Y filter', async ({ page }) => {
    await setup(page);
    await tlBtn(page, '1 Y').click();
    await page.waitForTimeout(200);
    expect(await visible(page)).toBeLessThan(14);
    await tlBtn(page, 'All').click();
    await page.waitForTimeout(200);
    expect(await visible(page)).toBe(14);
  });
});